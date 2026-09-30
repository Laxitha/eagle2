import csv
import io
import json

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.dependencies import get_current_user
from app.models.tables import AuditLog, User

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


def _log(db: Session, user: User, action: str, resource: str, details: str):
    db.add(AuditLog(user_id=user.id, action=action, resource=resource, details=details))
    db.commit()


@router.post("/csv")
async def ingest_csv(file: UploadFile, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    raw = (await file.read()).decode("utf-8")
    reader = csv.DictReader(io.StringIO(raw))
    rows = list(reader)
    _log(db, user, "ingest_csv", file.filename, f"{len(rows)} rows")
    return {"filename": file.filename, "rows_ingested": len(rows), "columns": reader.fieldnames}


@router.post("/json")
async def ingest_json(file: UploadFile, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    raw = (await file.read()).decode("utf-8")
    payload = json.loads(raw)
    count = len(payload) if isinstance(payload, list) else 1
    _log(db, user, "ingest_json", file.filename, f"{count} records")
    return {"filename": file.filename, "records_ingested": count}
