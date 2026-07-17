import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), default="user", nullable=False)  # user | admin | reviewer (RBAC later)
    created_at = Column(DateTime, default=datetime.utcnow)

    reports = relationship("Report", back_populates="user")


class ReportTemplate(Base):
    __tablename__ = "report_templates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    # Detected placeholder fields, e.g. [{"key": "policy_number", "label": "Policy Number", "style": "tag"}]
    fields = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    reports = relationship("Report", back_populates="template")


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    template_id = Column(UUID(as_uuid=False), ForeignKey("report_templates.id"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(30), default="draft")  # draft | extracting | review | completed | failed
    merged_data = Column(JSON, default=dict)   # {field_key: {"value": ..., "source": "doc_name", "confidence": "high"}}
    output_path = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="reports", lazy="joined")
    template = relationship("ReportTemplate", back_populates="reports")
    documents = relationship("ReportDocument", back_populates="report", cascade="all, delete-orphan")


class ReportDocument(Base):
    __tablename__ = "report_documents"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    report_id = Column(UUID(as_uuid=False), ForeignKey("reports.id"), nullable=False)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    doc_category = Column(String(50), default="unknown")  # policy | medical | id | bill | unknown
    extracted_data = Column(JSON, default=dict)
    status = Column(String(30), default="pending")  # pending | processing | done | failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="documents")
