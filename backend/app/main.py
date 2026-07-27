"""
SevaSetu API — entrypoint.

This is a working skeleton, not the finished pipeline. `/api/readiness-check`
below is a STUB: it returns a realistic, fixed response so the frontend,
Docker setup, and officer-dashboard wireframe all have a real contract to
build against from day one. Replace the body of `readiness_check()` with
calls into the real pipeline as each stage gets built:

    OCR extraction -> field normalization -> consistency engine
    -> missing-document checklist -> duplicate check -> aggregated score

Nothing else in this file needs to change when that swap happens — the
request/response shape is the contract.
"""
from pathlib import Path
from typing import List

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="SevaSetu API", version="0.1.0")

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sevasetu-api"}


class ReadinessRequest(BaseModel):
    application_id: str
    service_type: str


class FieldCheck(BaseModel):
    field: str
    status: str  # "pass" | "fail"
    detail: str


class ReadinessResponse(BaseModel):
    application_id: str
    readiness_score: int
    field_checks: List[FieldCheck]
    missing_documents: List[str]
    duplicate_suspected: bool
    estimated_delay_days: str
    recommendation: str


@app.post("/api/readiness-check", response_model=ReadinessResponse)
def readiness_check(payload: ReadinessRequest) -> ReadinessResponse:
    # STUB — see module docstring. Fixed example matching the target UX:
    # a mostly-clean application with one address mismatch and one
    # missing document.
    return ReadinessResponse(
        application_id=payload.application_id,
        readiness_score=82,
        field_checks=[
            FieldCheck(field="name", status="pass", detail="Matches across documents"),
            FieldCheck(field="date_of_birth", status="pass", detail="Matches across documents"),
            FieldCheck(
                field="address",
                status="fail",
                detail="Aadhaar lists '12 MG Road'; electricity bill lists '14 MG Road'",
            ),
        ],
        missing_documents=["residence_proof"],
        duplicate_suspected=False,
        estimated_delay_days="3-5",
        recommendation="Upload an updated Aadhaar or a matching residence proof before resubmitting.",
    )
