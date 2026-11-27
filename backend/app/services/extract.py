"""Pull plain text out of uploaded files."""
import io
from pathlib import Path

SUPPORTED = {".pdf", ".docx", ".txt", ".md"}
MAX_BYTES = 15 * 1024 * 1024


class ExtractionError(Exception):
    pass


def _pdf(data: bytes):
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                raise ExtractionError("PDF is password protected")
        pages = [(p.extract_text() or "").strip() for p in reader.pages]
    except PdfReadError as e:
        raise ExtractionError(f"Couldn't read PDF: {e}")
    return "\n\n".join(p for p in pages if p), len(pages)


def _docx(data: bytes):
    from docx import Document
    try:
        doc = Document(io.BytesIO(data))
    except Exception as e:
        raise ExtractionError(f"Couldn't read Word file: {e}")
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:                       # contracts often keep terms in tables
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return "\n".join(parts), None


def extract_text(filename: str, data: bytes):
    """Returns (text, page_count or None)."""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED:
        raise ExtractionError(f"Unsupported file type '{ext or 'none'}'. Use PDF, DOCX, TXT or MD.")
    if len(data) > MAX_BYTES:
        raise ExtractionError(f"File is larger than {MAX_BYTES // (1024 * 1024)} MB")

    if ext == ".pdf":
        text, pages = _pdf(data)
    elif ext == ".docx":
        text, pages = _docx(data)
    else:
        text, pages = data.decode("utf-8", errors="replace"), None

    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not text:
        hint = " It may be a scanned image, which needs OCR first." if ext == ".pdf" else ""
        raise ExtractionError("No text found in file." + hint)
    return text, pages
