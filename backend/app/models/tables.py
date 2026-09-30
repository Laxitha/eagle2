import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.postgres import Base


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="investigator")  # admin | investigator | analyst
    created_at = Column(DateTime, default=datetime.utcnow)


class Case(Base):
    __tablename__ = "cases"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    case_id = Column(String(50), unique=True, nullable=False)  # e.g. FIR-101
    date = Column(DateTime)
    description = Column(Text)
    status = Column(String(30), default="active")
    officer = Column(String(200))
    location = Column(String(200))
    category = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class Person(Base):
    __tablename__ = "persons"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    unified_id = Column(String(50), index=True)  # from entity resolution
    canonical_name = Column(String(255), nullable=False)
    aliases = Column(Text)  # JSON-encoded list of name variants seen
    address = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)


class Phone(Base):
    __tablename__ = "phones"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    number = Column(String(20), nullable=False, index=True)  # normalized
    person_id = Column(UUID(as_uuid=False), ForeignKey("persons.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    number = Column(String(20), nullable=False, index=True)  # normalized
    owner_person_id = Column(UUID(as_uuid=False), ForeignKey("persons.id"), nullable=True)
    model = Column(String(100))
    color = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)


class Account(Base):
    __tablename__ = "accounts"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    number = Column(String(30), nullable=False, index=True)  # normalized
    person_id = Column(UUID(as_uuid=False), ForeignKey("persons.id"), nullable=True)
    bank = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class Location(Base):
    __tablename__ = "locations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name = Column(String(200))
    lat = Column(Float)
    long = Column(Float)
    entity_id = Column(String(50))  # loosely-typed pointer (person/vehicle/etc)
    timestamp = Column(DateTime)
    source = Column(String(200))


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    org_type = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    filename = Column(String(500), nullable=False)
    file_type = Column(String(50))
    case_id = Column(UUID(as_uuid=False), ForeignKey("cases.id"), nullable=True)
    content_text = Column(Text)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    relationship_id = Column(String(100), nullable=False, index=True)  # Neo4j relationship elementId
    source_document_id = Column(UUID(as_uuid=False), ForeignKey("documents.id"), nullable=True)
    source_type = Column(String(50))  # cdr | financial | vehicle | report | manual
    confidence = Column(Float, default=0.5)
    verification_status = Column(String(30), default="unverified")  # unverified | verified | rejected
    verified_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Lead(Base):
    __tablename__ = "leads"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    entity_id = Column(String(50), nullable=False, index=True)
    score = Column(Float, nullable=False)
    reason = Column(Text)
    recommended_action = Column(Text)
    status = Column(String(30), default="pending")  # pending | verified | rejected
    verified_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    action = Column(String(200), nullable=False)
    resource = Column(String(200))
    details = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
