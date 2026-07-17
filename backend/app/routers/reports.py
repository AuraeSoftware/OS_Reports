import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db, AsyncSessionLocal
from ..models import User, Report, ReportDocument, ReportTemplate
from ..schemas import ReportOut, ReportCreate, MergedDataUpdate
from ..auth import get_current_user
from ..ocr_service import extract_from_document, merge_extractions
from ..template_service import fill_template

router = APIRouter(prefix="/api/reports", tags=["reports"])

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "documents")
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "outputs")
os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)


async def _get_accessible_report(report_id: str, user: User, db: AsyncSession) -> Report:
    """Owner, or admin/reviewer — used for read/review actions."""
    conditions = [Report.id == report_id]
    if user.role not in ("admin", "reviewer"):
        conditions.append(Report.user_id == user.id)
    result = await db.execute(
        select(Report).options(selectinload(Report.documents)).where(*conditions)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


def _with_owner(report: Report, owner: User | None) -> ReportOut:
    out = ReportOut.model_validate(report)
    if owner:
        out.owner_name = owner.full_name
        out.owner_email = owner.email
    return out


@router.post("", response_model=ReportOut)
async def create_report(payload: ReportCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == payload.template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    report = Report(user_id=current_user.id, template_id=template.id, name=payload.name, status="draft")
    db.add(report)
    await db.commit()
    await db.refresh(report, attribute_names=["documents"])
    return ReportOut.model_validate(report)


@router.get("", response_model=list[ReportOut])
async def list_reports(
    scope: str = "mine",  # "mine" | "all" (all is only honored for admin/reviewer)
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Report).options(selectinload(Report.documents), selectinload(Report.user))
    if scope == "all" and current_user.role in ("admin", "reviewer"):
        pass  # no user filter — team-wide view
    else:
        query = query.where(Report.user_id == current_user.id)
    query = query.order_by(Report.created_at.desc())

    result = await db.execute(query)
    reports = result.scalars().all()
    return [_with_owner(r, r.user) for r in reports]


@router.get("/{report_id}", response_model=ReportOut)
async def get_report(report_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = await _get_accessible_report(report_id, current_user, db)
    owner_result = await db.execute(select(User).where(User.id == report.user_id))
    return _with_owner(report, owner_result.scalar_one_or_none())


@router.post("/{report_id}/documents", response_model=ReportOut)
async def upload_documents(
    report_id: str,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await _get_accessible_report(report_id, current_user, db)

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.filename}")
        file_id = str(uuid.uuid4())
        storage_path = os.path.join(DOCS_DIR, f"{file_id}{ext}")
        contents = await file.read()
        async with aiofiles.open(storage_path, "wb") as f:
            await f.write(contents)

        doc = ReportDocument(
            report_id=report.id,
            original_filename=file.filename,
            storage_path=storage_path,
            status="pending",
        )
        db.add(doc)

    await db.commit()
    await db.refresh(report, attribute_names=["documents"])
    return ReportOut.model_validate(report)


async def _run_extraction(report_id: str):
    """Background task: extract each document with Gemini, then merge into the report."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Report).options(selectinload(Report.documents)).where(Report.id == report_id)
        )
        report = result.scalar_one_or_none()
        if not report:
            return

        template_result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == report.template_id))
        template = template_result.scalar_one_or_none()
        fields = template.fields if template else []

        report.status = "extracting"
        await db.commit()

        per_doc_results = []
        docs_meta = []
        try:
            for doc in report.documents:
                doc.status = "processing"
                await db.commit()
                try:
                    result_json = extract_from_document(doc.storage_path, fields)
                    doc.extracted_data = result_json.get("fields", {})
                    doc.doc_category = result_json.get("doc_category", "unknown")
                    doc.status = "done"
                except Exception as e:
                    doc.status = "failed"
                    doc.error_message = str(e)
                    result_json = {"fields": {}}
                per_doc_results.append(result_json)
                docs_meta.append({"filename": doc.original_filename})
                await db.commit()

            merged = merge_extractions(per_doc_results, docs_meta, fields)
            report.merged_data = merged
            report.status = "review"
        except Exception as e:
            report.status = "failed"
            report.error_message = str(e)
        await db.commit()


@router.post("/{report_id}/extract", response_model=ReportOut)
async def extract_report(
    report_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await _get_accessible_report(report_id, current_user, db)
    if not report.documents:
        raise HTTPException(status_code=400, detail="Upload at least one document before extracting")

    report.status = "extracting"
    await db.commit()
    background_tasks.add_task(_run_extraction, report_id)
    await db.refresh(report, attribute_names=["documents"])
    return ReportOut.model_validate(report)


@router.patch("/{report_id}/fields", response_model=ReportOut)
async def update_fields(
    report_id: str,
    payload: MergedDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await _get_accessible_report(report_id, current_user, db)
    merged = dict(report.merged_data or {})
    for key, value in payload.fields.items():
        existing_source = (merged.get(key) or {}).get("source")
        merged[key] = {"value": value, "source": existing_source}
    report.merged_data = merged
    await db.commit()
    await db.refresh(report, attribute_names=["documents"])
    return ReportOut.model_validate(report)


@router.post("/{report_id}/generate", response_model=ReportOut)
async def generate_report(report_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = await _get_accessible_report(report_id, current_user, db)

    template_result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == report.template_id))
    template = template_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    flat_data = {key: (v or {}).get("value") for key, v in (report.merged_data or {}).items()}

    output_path = os.path.join(OUTPUTS_DIR, f"{report.id}.docx")
    try:
        fill_template(template.storage_path, flat_data, output_path)
    except Exception as e:
        report.status = "failed"
        report.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Could not generate document: {e}")

    report.output_path = output_path
    report.status = "completed"
    await db.commit()
    await db.refresh(report, attribute_names=["documents"])
    return ReportOut.model_validate(report)


@router.get("/{report_id}/download")
async def download_report(report_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = await _get_accessible_report(report_id, current_user, db)
    if not report.output_path or not os.path.exists(report.output_path):
        raise HTTPException(status_code=404, detail="Report has not been generated yet")
    return FileResponse(
        report.output_path,
        filename=f"{report.name}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.delete("/{report_id}")
async def delete_report(report_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = await _get_accessible_report(report_id, current_user, db)
    await db.delete(report)
    await db.commit()
    return {"ok": True}
