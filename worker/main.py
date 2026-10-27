"""FolioLense worker: statement parsing and price jobs (PRD section 10).

- /health            : liveness
- /parse/cas         : CAMS/KFin CAS or NSDL/CDSL e-CAS PDF -> rows / holdings (casparser)
- Price jobs run from the CLI (jobs/run.py), not here.

The app sends the uploaded PDF + password here; nothing is stored by the worker.
"""

from __future__ import annotations

import io

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from jobs import statements

app = FastAPI(title="FolioLense worker")
# the app (localhost:3000 in dev) calls this directly from the browser for PDF parsing
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "foliolense-worker"}


@app.post("/parse/cas")
async def parse_cas(file: UploadFile, password: str = Form(""), kind: str = Form("cas")) -> dict:
    """kind='cas' for CAMS/KFin (transactions), 'ecas' for NSDL/CDSL (holdings snapshot)."""
    import casparser

    raw = await file.read()
    try:
        data = casparser.read_cas_pdf(io.BytesIO(raw), password, output="dict").model_dump()
    except Exception as e:  # casparser raises on wrong password / unsupported file
        msg = str(e).lower()
        if "password" in msg or "decrypt" in msg:
            raise HTTPException(status_code=422, detail="Wrong password for this PDF.") from e
        raise HTTPException(status_code=422, detail=f"Could not read this statement: {e}") from e

    if kind == "ecas" or data.get("demat_accounts"):
        return {"mode": "holdings", **statements.ecas_to_holdings(data)}
    return {"mode": "transactions", **statements.cas_to_rows(data)}


@app.post("/parse/contractnote")
async def parse_contractnote(file: UploadFile) -> dict:
    """Original broker contract-note PDF (no password). Detects the broker from the text."""
    import pdfplumber

    raw = await file.read()
    try:
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            pages = [(p.extract_text() or "") for p in pdf.pages]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read this PDF: {e}") from e

    head = "\n".join(pages[:2])
    if "Zerodha" in head:
        out = statements.zerodha_cn_parse(pages)
        if not out["rows"]:
            raise HTTPException(status_code=422, detail="No equity trades found in this Zerodha contract note.")
        return {"mode": "transactions", "broker": "Zerodha", **out}
    if "Anand Rathi" in head:
        raise HTTPException(status_code=422, detail="This Anand Rathi note is mostly F&O; that is imported in the F&O book (coming in Phase 5). For Anand Rathi equity, use the Trade Details export.")
    raise HTTPException(status_code=422, detail="Unrecognised contract note. Supported now: Zerodha equity contract notes.")
