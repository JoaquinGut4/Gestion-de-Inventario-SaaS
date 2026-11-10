"""Generador de PDFs tabulares sin dependencias externas.

Los reportes usan el mismo generador para conservar encabezados, paginación,
filas alternas y resumen. Está pensado para tablas operativas, no para
documentos tributarios.
"""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Sequence


PAGE_WIDTH = 842
PAGE_HEIGHT = 595
MARGIN = 28
TABLE_TOP = 505
HEADER_HEIGHT = 24
ROW_PADDING = 5
LINE_HEIGHT = 9.2
ROW_FONT_SIZE = 7.2
HEADER_FONT_SIZE = 7.4
MAX_CELL_LINES = 3
BRAND = (20 / 255, 38 / 255, 74 / 255)
TEXT = (0.12, 0.16, 0.23)
MUTED = (0.42, 0.47, 0.55)
LIGHT = (0.965, 0.973, 0.984)
BORDER = (0.85, 0.88, 0.92)


def _clean(value: object) -> str:
    text = str(value if value is not None else "").replace("\r", " ").replace("\n", " ")
    return text.encode("latin-1", "replace").decode("latin-1")


def _escape(value: object) -> str:
    return _clean(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _wrap(value: object, max_chars: int) -> list[str]:
    words = _clean(value).split()
    if not words:
        return [""]
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
            while len(current) > max_chars:
                lines.append(current[:max_chars])
                current = current[max_chars:]
    if current:
        lines.append(current)
    if len(lines) > MAX_CELL_LINES:
        lines = lines[:MAX_CELL_LINES]
        lines[-1] = f"{lines[-1][:max(1, max_chars - 3)]}..."
    return lines


def _text(x: float, y: float, value: object, size: float = 8, bold: bool = False, color: tuple[float, float, float] = TEXT) -> str:
    font = "F2" if bold else "F1"
    return f"q {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg BT /{font} {size:.2f} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({_escape(value)}) Tj ET Q"


def _rect(x: float, y: float, width: float, height: float, color: tuple[float, float, float]) -> str:
    return f"q {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg {x:.2f} {y:.2f} {width:.2f} {height:.2f} re f Q"


def _line(x1: float, y1: float, x2: float, y2: float, color: tuple[float, float, float] = BORDER) -> str:
    return f"q {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} RG 0.5 w {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S Q"


def _pdf_bytes(pages: list[str]) -> bytes:
    objects: list[bytes] = []
    page_count = len(pages)
    font_one = 3 + page_count * 2
    font_two = font_one + 1

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{3 + index * 2} 0 R" for index in range(page_count))
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode())

    for index, content in enumerate(pages):
        page_id = 3 + index * 2
        content_id = page_id + 1
        page = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {font_one} 0 R /F2 {font_two} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        )
        encoded = content.encode("latin-1", "replace")
        objects.append(page.encode())
        objects.append(b"<< /Length " + str(len(encoded)).encode() + b" >>\nstream\n" + encoded + b"\nendstream")

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode())
        output.extend(obj)
        output.extend(b"\nendobj\n")

    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    )
    return bytes(output)


def table_pdf(
    title: str,
    subtitle: str,
    columns: Sequence[tuple[str, float]],
    rows: Iterable[Sequence[object]],
    summary: Sequence[tuple[str, object]] = (),
) -> bytes:
    """Construye un PDF A4 horizontal con una tabla y paginación."""
    content_width = PAGE_WIDTH - MARGIN * 2
    weights = sum(max(0.1, weight) for _, weight in columns)
    widths = [max(0.1, weight) / weights * content_width for _, weight in columns]
    rows = [list(row) for row in rows]
    pages: list[str] = []
    commands: list[str] = []
    page_number = 1

    def start_page() -> None:
        nonlocal commands
        commands = []
        commands.append(_text(MARGIN, PAGE_HEIGHT - 42, title, 15, True, BRAND))
        commands.append(_text(MARGIN, PAGE_HEIGHT - 57, subtitle, 7.5, False, MUTED))
        if page_number == 1:
            summary_text = "   |   ".join(f"{label}: {value}" for label, value in summary)
            if summary_text:
                commands.append(_text(MARGIN, PAGE_HEIGHT - 70, summary_text, 7.5, False, TEXT))

    def draw_table_header(y: float) -> float:
        commands.append(_rect(MARGIN, y - HEADER_HEIGHT, content_width, HEADER_HEIGHT, BRAND))
        x = MARGIN
        for (label, _), width in zip(columns, widths):
            commands.append(_text(x + 4, y - 15, label, HEADER_FONT_SIZE, True, (1, 1, 1)))
            x += width
        return y - HEADER_HEIGHT

    def finish_page(y: float) -> None:
        commands.append(_text(MARGIN, 20, f"AD GLOBAL · {datetime.now():%d/%m/%Y %H:%M}", 6.5, False, MUTED))
        commands.append(_text(PAGE_WIDTH - MARGIN - 55, 20, f"Página {page_number}", 6.5, False, MUTED))
        pages.append("\n".join(commands))

    start_page()
    if not rows:
        rows = [["Sin registros para los filtros seleccionados"] + [""] * (len(columns) - 1)]
    header_y = draw_table_header(TABLE_TOP)
    y = header_y - 4

    for row_index, row in enumerate(rows):
        cell_lines = [
            _wrap(row[index] if index < len(row) else "", max(4, int(width / (ROW_FONT_SIZE * 0.52))))
            for index, width in enumerate(widths)
        ]
        row_height = max(len(lines) for lines in cell_lines) * LINE_HEIGHT + ROW_PADDING * 2
        if y - row_height < 34:
            finish_page(y)
            page_number += 1
            start_page()
            y = draw_table_header(TABLE_TOP) - 4

        if row_index % 2 == 1:
            commands.append(_rect(MARGIN, y - row_height, content_width, row_height, LIGHT))
        x = MARGIN
        for lines, width in zip(cell_lines, widths):
            text_y = y - ROW_PADDING - ROW_FONT_SIZE
            for line in lines:
                commands.append(_text(x + 4, text_y, line, ROW_FONT_SIZE, False, TEXT))
                text_y -= LINE_HEIGHT
            x += width
        commands.append(_line(MARGIN, y - row_height, PAGE_WIDTH - MARGIN, y - row_height))
        y -= row_height

    finish_page(y)
    return _pdf_bytes(pages)
