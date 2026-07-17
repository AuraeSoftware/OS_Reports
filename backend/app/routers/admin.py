from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models import User, Report
from ..schemas import UserAdminOut, RoleUpdate, AdminStats
from ..auth import require_roles

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_ROLES = {"admin", "reviewer", "user"}


@router.get("/users", response_model=list[UserAdminOut])
async def list_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_roles("admin"))):
    result = await db.execute(
        select(User, func.count(Report.id).label("report_count"))
        .outerjoin(Report, Report.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.asc())
    )
    out = []
    for user, report_count in result.all():
        item = UserAdminOut.model_validate(user)
        item.report_count = report_count or 0
        out.append(item)
    return out


@router.patch("/users/{user_id}/role", response_model=UserAdminOut)
async def update_user_role(
    user_id: str,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {sorted(VALID_ROLES)}")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and payload.role != "admin":
        raise HTTPException(status_code=400, detail="You can't demote your own account")

    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    out = UserAdminOut.model_validate(user)
    count_result = await db.execute(select(func.count(Report.id)).where(Report.user_id == user.id))
    out.report_count = count_result.scalar() or 0
    return out


@router.get("/stats", response_model=AdminStats)
async def admin_stats(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_roles("admin", "reviewer"))):
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_reports = (await db.execute(select(func.count(Report.id)))).scalar() or 0
    pending_review = (await db.execute(select(func.count(Report.id)).where(Report.status == "review"))).scalar() or 0
    completed = (await db.execute(select(func.count(Report.id)).where(Report.status == "completed"))).scalar() or 0

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = (
        await db.execute(select(func.count(Report.id)).where(Report.created_at >= month_start))
    ).scalar() or 0

    return AdminStats(
        total_users=total_users,
        total_reports=total_reports,
        reports_pending_review=pending_review,
        reports_completed=completed,
        reports_this_month=this_month,
    )
