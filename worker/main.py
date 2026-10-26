"""FolioLense worker: statement parsing and price jobs (PRD section 10).

Phase 0 has only the health check. Parsers arrive in Phase 3, price jobs in Phase 2.
"""

from fastapi import FastAPI

app = FastAPI(title="FolioLense worker")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "foliolense-worker"}
