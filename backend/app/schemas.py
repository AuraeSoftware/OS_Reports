from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from datetime import datetime


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TemplateOut(BaseModel):
    id: str
    name: str
    original_filename: str
    fields: list
    created_at: datetime

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    template_id: str
    name: str


class ReportDocumentOut(BaseModel):
    id: str
    original_filename: str
    doc_category: str
    status: str
    extracted_data: dict

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    id: str
    name: str
    status: str
    merged_data: dict
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    documents: list[ReportDocumentOut] = []
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None

    class Config:
        from_attributes = True


class FieldUpdate(BaseModel):
    field_key: str
    value: Any


class MergedDataUpdate(BaseModel):
    fields: dict[str, Any]


class RoleUpdate(BaseModel):
    role: str  # "admin" | "reviewer" | "user"


class UserAdminOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    created_at: datetime
    report_count: int = 0

    class Config:
        from_attributes = True


class AdminStats(BaseModel):
    total_users: int
    total_reports: int
    reports_pending_review: int
    reports_completed: int
    reports_this_month: int
