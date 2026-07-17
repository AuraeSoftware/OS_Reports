import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import User, ReportTemplate
from ..schemas import TemplateOut
from ..auth import get_current_user
from ..template_service import detect_fields

router = APIRouter(prefix="/api/templates", tags=["templates"])

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "templates")
os.makedirs(STORAGE_DIR, exist_ok=True)


@router.post("/upload", response_model=TemplateOut)
async def upload_template(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Template must be a .docx file")

    file_id = str(uuid.uuid4())
    storage_path = os.path.join(STORAGE_DIR, f"{file_id}.docx")

    contents = await file.read()
    async with aiofiles.open(storage_path, "wb") as f:
        await f.write(contents)

    try:
        fields = detect_fields(storage_path)
    except Exception as e:
        os.remove(storage_path)
        raise HTTPException(status_code=400, detail=f"Could not read template: {e}")

    if not fields:
        os.remove(storage_path)
        raise HTTPException(
            status_code=400,
            detail="No fillable fields detected. Use {{field_name}} tags or 'Label:' style placeholders.",
        )

    template = ReportTemplate(
        user_id=current_user.id,
        name=name,
        original_filename=file.filename,
        storage_path=storage_path,
        fields=fields,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return TemplateOut.model_validate(template)


@router.get("", response_model=list[TemplateOut])
async def list_templates(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ReportTemplate).where(ReportTemplate.user_id == current_user.id).order_by(ReportTemplate.created_at.desc())
    )
    return [TemplateOut.model_validate(t) for t in result.scalars().all()]


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ReportTemplate).where(ReportTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateOut.model_validate(template)
