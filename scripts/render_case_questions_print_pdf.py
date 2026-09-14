#!/usr/bin/env python3
"""Render every published case-style question into a one-case-per-page A4 PDF.

The learning classification catalog is the source of truth for case-style
subquestions.  This matters for legacy parents whose authoring subquestion does
not carry a ``question_style`` field even though the current learning catalog
classifies it as a case question.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from pypdf import PdfReader
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "cpa_uploader" / "data" / "cpa_question_sets_v3.authoring.json"
DEFAULT_CLASSIFICATIONS = ROOT / "cpa_uploader" / "data" / "learning-question-classifications.json"
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "audit_say-case-questions-printable-2026-09-14.pdf"
DEFAULT_QA = ROOT / "tmp" / "pdfs" / "audit_say-case-questions-printable-2026-09-14-layout.json"

FONT_REGULAR = "MalgunGothic"
FONT_BOLD = "MalgunGothicBold"
FONT_REGULAR_FILE = Path("C:/Windows/Fonts/malgun.ttf")
FONT_BOLD_FILE = Path("C:/Windows/Fonts/malgunbd.ttf")

PAGE_WIDTH, PAGE_HEIGHT = landscape(A4)
MARGIN_X = 28.5  # 10 mm
MARGIN_TOP = 27.0
MARGIN_BOTTOM = 24.0
HEADER_HEIGHT = 31.0
GUTTER = 17.0  # 6 mm
PANEL_PADDING = 11.0
FACT_PANEL_RATIO = 0.49
PANEL_FILL = Color(0.975, 0.98, 0.985)
PANEL_BORDER = HexColor("#B9C4D0")
ACCENT = HexColor("#174A72")
TEXT = HexColor("#1F2933")
MUTED = HexColor("#52616B")
FOOTER = HexColor("#62707C")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def register_fonts() -> None:
    if not FONT_REGULAR_FILE.is_file() or not FONT_BOLD_FILE.is_file():
        raise FileNotFoundError("Korean print fonts (Malgun Gothic) are unavailable.")
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(FONT_REGULAR_FILE)))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONT_BOLD_FILE)))


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap_paragraph(text: str, font: str, size: float, max_width: float) -> list[str]:
    """Wrap Korean and mixed text without discarding any characters."""
    if not text:
        return [""]
    lines: list[str] = []
    remaining = text.strip()
    while remaining:
        if text_width(remaining, font, size) <= max_width:
            lines.append(remaining)
            break
        candidate = ""
        last_space = -1
        cut = 0
        for index, character in enumerate(remaining):
            trial = candidate + character
            if text_width(trial, font, size) > max_width:
                break
            candidate = trial
            cut = index + 1
            if character.isspace():
                last_space = cut
        if cut == 0:
            raise ValueError(f"A glyph cannot fit at {size}pt: {remaining[:40]!r}")
        if last_space > 0 and last_space >= int(cut * 0.60):
            cut = last_space
        line = remaining[:cut].rstrip()
        if not line:
            line = remaining[:cut]
        lines.append(line)
        remaining = remaining[cut:].lstrip()
    return lines


def wrap_text(text: str, font: str, size: float, max_width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        lines.extend(wrap_paragraph(paragraph, font, size, max_width))
    return lines


def leading(size: float) -> float:
    return size * 1.24


def block_height(lines: Iterable[str], size: float, after: float = 0.0) -> float:
    return len(list(lines)) * leading(size) + after


def points_for(question: dict[str, Any]) -> int:
    return sum(int(item.get("max_points", 0)) for item in question.get("criteria", []))


def classification_map(classifications: list[dict[str, Any]]) -> dict[str, set[str]]:
    case_ids: dict[str, set[str]] = defaultdict(set)
    for entry in classifications:
        if entry.get("question_style") == "case":
            set_id = entry.get("source_set_id")
            subquestion_id = entry.get("subquestion_id")
            if not isinstance(set_id, str) or not isinstance(subquestion_id, str):
                raise ValueError("Case classification must name its source set and subquestion.")
            case_ids[set_id].add(subquestion_id)
    return dict(case_ids)


def load_case_sets(input_path: Path, classification_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    bank = json.loads(input_path.read_text(encoding="utf-8"))
    catalog = json.loads(classification_path.read_text(encoding="utf-8"))
    classifications = catalog.get("classifications")
    if not isinstance(bank, list) or not isinstance(classifications, list):
        raise ValueError("Unexpected question-bank or classification catalog shape.")

    selected = classification_map(classifications)
    unmatched = set(selected)
    cases: list[dict[str, Any]] = []
    for source_set in bank:
        set_id = source_set.get("id")
        if set_id not in selected:
            continue
        unmatched.remove(set_id)
        if source_set.get("status") != "published":
            raise ValueError(f"Case classification refers to non-published set: {set_id}")
        wanted = selected[set_id]
        questions = [question for question in source_set.get("subquestions", []) if question.get("id") in wanted]
        found = {question.get("id") for question in questions}
        if found != wanted:
            raise ValueError(f"Missing classified case subquestion(s) in {set_id}: {sorted(wanted - found)}")
        facts = [str(item.get("text", "")).strip() for item in source_set.get("shared_context", {}).get("facts", [])]
        facts = [fact for fact in facts if fact]
        if not facts:
            raise ValueError(f"Case set has no parent facts: {set_id}")
        if not questions:
            raise ValueError(f"Case set has no selected questions: {set_id}")
        cases.append({
            "id": set_id,
            "title": str(source_set.get("title", "")).strip(),
            "facts": facts,
            "questions": questions,
        })
    if unmatched:
        raise ValueError(f"Classified case parent(s) missing from bank: {sorted(unmatched)}")
    if not cases:
        raise ValueError("No published case-style questions found.")
    metadata = {
        "authoring_bank_sha256": sha256_file(input_path),
        "classification_catalog_sha256": sha256_file(classification_path),
        "published_case_sets": len(cases),
        "published_case_questions": sum(len(case["questions"]) for case in cases),
    }
    return cases, metadata


def make_left_blocks(case: dict[str, Any], size: float) -> list[dict[str, Any]]:
    body = size
    blocks: list[dict[str, Any]] = [{"kind": "section", "text": "사실관계", "size": size + 0.55, "after": 4.0}]
    for fact in case["facts"]:
        blocks.append({"kind": "paragraph", "text": fact, "size": body, "after": 3.0})
    if blocks:
        blocks[-1]["after"] = 0.0
    return blocks


def make_right_blocks(case: dict[str, Any], size: float) -> list[dict[str, Any]]:
    prompt_size = size
    answer_size = size - 0.10
    label_size = size + 0.35
    blocks: list[dict[str, Any]] = [{"kind": "section", "text": "물음과 모범답안", "size": size + 0.55, "after": 4.0}]
    for index, question in enumerate(case["questions"], start=1):
        points = points_for(question)
        blocks.append({"kind": "question", "text": f"물음 {index}" + (f" ({points}점)" if points else ""), "size": label_size, "after": 2.0})
        blocks.append({"kind": "paragraph", "text": str(question.get("prompt", "")).strip(), "size": prompt_size, "after": 2.0})
        blocks.append({"kind": "answer_label", "text": "모범답안", "size": label_size, "after": 1.2})
        answers = question.get("model_answer", [])
        if not isinstance(answers, list) or not answers:
            raise ValueError(f"Case question lacks model answer: {case['id']}/{question.get('id')}")
        for answer_index, answer in enumerate(answers):
            blocks.append({"kind": "answer", "text": str(answer).strip(), "size": answer_size,
                           "after": 1.4 if answer_index < len(answers) - 1 else 4.3})
    if blocks:
        blocks[-1]["after"] = 0.0
    return blocks


def expand_blocks(blocks: list[dict[str, Any]], width: float) -> tuple[list[dict[str, Any]], float]:
    rendered: list[dict[str, Any]] = []
    used = 0.0
    for block in blocks:
        kind, size = block["kind"], float(block["size"])
        if kind == "section":
            font, indent, color = FONT_BOLD, 0.0, ACCENT
            content_width = width
        elif kind == "question":
            font, indent, color = FONT_BOLD, 0.0, TEXT
            content_width = width
        elif kind == "answer_label":
            font, indent, color = FONT_BOLD, 0.0, MUTED
            content_width = width
        elif kind == "answer":
            font, indent, color = FONT_REGULAR, size * 1.15, TEXT
            content_width = width - indent
        else:
            font, indent, color = FONT_REGULAR, 0.0, TEXT
            content_width = width
        lines = wrap_text(block["text"], font, size, content_width)
        line_height = leading(size)
        rendered.append({
            **block,
            "font": font,
            "indent": indent,
            "color": color,
            "lines": lines,
            "line_height": line_height,
        })
        used += len(lines) * line_height + float(block.get("after", 0.0))
    return rendered, used


def fit_case(case: dict[str, Any], left_width: float, right_width: float, height: float) -> dict[str, Any]:
    # The lower bound preserves practical readability on A4 paper.  Pages that
    # overflow at the default scale alone shrink; no content is omitted.
    for size in (8.20, 8.00, 7.80, 7.60, 7.40):
        left, left_used = expand_blocks(make_left_blocks(case, size), left_width)
        right, right_used = expand_blocks(make_right_blocks(case, size), right_width)
        if left_used <= height and right_used <= height:
            return {
                "body_font_size": size,
                "left": left,
                "right": right,
                "left_used": left_used,
                "right_used": right_used,
                "available_height": height,
            }
    raise ValueError(
        f"One-page A4 layout cannot fit {case['id']} above the 7.4pt readability floor. "
        "Revise the layout; do not drop text or create a second page."
    )


def draw_blocks(canvas: Canvas, x: float, top: float, blocks: list[dict[str, Any]]) -> float:
    y = top
    for block in blocks:
        for line_index, line in enumerate(block["lines"]):
            canvas.setFont(block["font"], block["size"])
            canvas.setFillColor(block["color"])
            if block["kind"] == "answer" and line_index == 0:
                canvas.drawString(x, y, "-")
            canvas.drawString(x + block["indent"], y, line)
            y -= block["line_height"]
        y -= float(block.get("after", 0.0))
    return y


def draw_page(canvas: Canvas, case: dict[str, Any], page_number: int, page_count: int, fitted: dict[str, Any]) -> None:
    available_width = PAGE_WIDTH - (MARGIN_X * 2)
    left_width = (available_width - GUTTER) * FACT_PANEL_RATIO
    right_width = available_width - GUTTER - left_width
    panels_top = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT
    panels_bottom = MARGIN_BOTTOM
    panel_height = panels_top - panels_bottom
    left_x = MARGIN_X
    right_x = left_x + left_width + GUTTER

    canvas.setFillColor(ACCENT)
    canvas.setFont(FONT_BOLD, 12.1)
    canvas.drawString(MARGIN_X, PAGE_HEIGHT - MARGIN_TOP + 2.0, case["title"])
    canvas.setFont(FONT_REGULAR, 7.1)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - MARGIN_TOP + 3.0, "회계감사 사례형 문제 인쇄본")

    for panel_x, panel_width in ((left_x, left_width), (right_x, right_width)):
        canvas.setStrokeColor(PANEL_BORDER)
        canvas.setFillColor(PANEL_FILL)
        canvas.roundRect(panel_x, panels_bottom, panel_width, panel_height, 5.0, stroke=1, fill=1)

    left_bottom = draw_blocks(canvas, left_x + PANEL_PADDING, panels_top - PANEL_PADDING, fitted["left"])
    right_bottom = draw_blocks(canvas, right_x + PANEL_PADDING, panels_top - PANEL_PADDING, fitted["right"])
    if left_bottom < panels_bottom + PANEL_PADDING - 0.05 or right_bottom < panels_bottom + PANEL_PADDING - 0.05:
        raise ValueError(f"Rendered layout overflowed case page: {case['id']}")

    canvas.setStrokeColor(PANEL_BORDER)
    canvas.setLineWidth(0.35)
    canvas.line(MARGIN_X, 14.5, PAGE_WIDTH - MARGIN_X, 14.5)
    canvas.setFont(FONT_REGULAR, 6.8)
    canvas.setFillColor(FOOTER)
    canvas.drawString(MARGIN_X, 6.0, f"{case['id']} | 사례형 물음 {len(case['questions'])}개")
    canvas.drawRightString(PAGE_WIDTH - MARGIN_X, 6.0, f"{page_number} / {page_count}")


def render(cases: list[dict[str, Any]], output: Path, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(output), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), invariant=1)
    canvas.setTitle("회계감사 사례형 문제 인쇄본")
    canvas.setAuthor("audit_say")
    canvas.setSubject("사실관계, 물음, 모범답안을 사례별 한 페이지에 수록한 인쇄본")
    canvas.setCreator("audit_say printable case-question renderer")
    canvas.setPageCompression(1)

    available_width = PAGE_WIDTH - (MARGIN_X * 2)
    left_width = (available_width - GUTTER) * FACT_PANEL_RATIO - (PANEL_PADDING * 2)
    right_width = available_width - GUTTER - ((available_width - GUTTER) * FACT_PANEL_RATIO) - (PANEL_PADDING * 2)
    available_height = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT - MARGIN_BOTTOM - (PANEL_PADDING * 2)
    page_layouts: list[dict[str, Any]] = []
    for page_number, case in enumerate(cases, start=1):
        fitted = fit_case(case, left_width, right_width, available_height)
        canvas.bookmarkPage(case["id"])
        canvas.addOutlineEntry(case["title"], case["id"], level=0, closed=False)
        draw_page(canvas, case, page_number, len(cases), fitted)
        page_layouts.append({
            "page": page_number,
            "set_id": case["id"],
            "title": case["title"],
            "case_question_ids": [question["id"] for question in case["questions"]],
            "body_font_size_pt": fitted["body_font_size"],
            "facts_panel_used_pt": round(fitted["left_used"], 2),
            "questions_answers_panel_used_pt": round(fitted["right_used"], 2),
            "panel_available_pt": round(fitted["available_height"], 2),
        })
        canvas.showPage()
    canvas.save()
    return page_layouts


def verify_pdf(output: Path, cases: list[dict[str, Any]]) -> None:
    reader = PdfReader(str(output))
    if len(reader.pages) != len(cases):
        raise ValueError(f"Expected {len(cases)} PDF pages, found {len(reader.pages)}.")
    for page, case in zip(reader.pages, cases, strict=True):
        text = page.extract_text() or ""
        normalized_page = "".join(text.split())
        if "".join(case["title"].split()) not in normalized_page:
            raise ValueError(f"Extracted PDF text does not contain title: {case['id']}")
        for question in case["questions"]:
            prompt = str(question.get("prompt", "")).strip()
            if prompt and "".join(prompt.split()) not in normalized_page:
                raise ValueError(f"Extracted PDF text is missing prompt: {case['id']}/{question['id']}")
            for answer in question.get("model_answer", []):
                answer_text = str(answer).strip()
                if answer_text and "".join(answer_text.split()) not in normalized_page:
                    raise ValueError(f"Extracted PDF text is missing model answer: {case['id']}/{question['id']}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--classifications", type=Path, default=DEFAULT_CLASSIFICATIONS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--qa", type=Path, default=DEFAULT_QA)
    args = parser.parse_args()

    register_fonts()
    cases, metadata = load_case_sets(args.input, args.classifications)
    layouts = render(cases, args.output, metadata)
    verify_pdf(args.output, cases)
    args.qa.parent.mkdir(parents=True, exist_ok=True)
    qa = {
        "status": "generated_and_structure_verified",
        "output": str(args.output),
        "output_sha256": sha256_file(args.output),
        "page_size": "A4 landscape",
        "one_case_per_page": True,
        **metadata,
        "pages": layouts,
        "all_pages_fit": all(
            max(page["facts_panel_used_pt"], page["questions_answers_panel_used_pt"]) <= page["panel_available_pt"]
            for page in layouts
        ),
    }
    args.qa.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "pages": len(cases),
        "case_questions": metadata["published_case_questions"],
        "output_sha256": qa["output_sha256"],
        "minimum_body_font_size_pt": min(page["body_font_size_pt"] for page in layouts),
        "maximum_body_font_size_pt": max(page["body_font_size_pt"] for page in layouts),
        "qa": str(args.qa),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
