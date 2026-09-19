# r11: KGA 705 발췌(2025 전문 PDF 744·745·747·751·752·754·755쪽)의 원본 대조용 쪽 텍스트와 이미지를 raw originals에 새로 쓴다.
# 기존 PyMuPDF 페이지 텍스트(kga-2025-pymupdf-pages.txt)의 같은 쪽과 비교해 결과를 출력하며, 기존 파일이 있으면 쓰지 않는다.
#   uv run --offline --no-project --with pymupdf python cpa_uploader/drafts/case-review-2026-09-15/r11-scope-limitation-disclaimer/sources/render-kga705-pages.py
import hashlib
import json
import pathlib

import pymupdf

PDF = pathlib.Path('cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf')
DUMP = pathlib.Path('cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt')
RAW = pathlib.Path('cpa_uploader/raw/originals/case-review-2026-09-15')
PAGES = [744, 745, 747, 751, 752, 754, 755]

assert hashlib.sha256(PDF.read_bytes()).hexdigest() == 'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989'
assert hashlib.sha256(DUMP.read_bytes()).hexdigest() == 'b626436fcb11ce0c8a51e542d6e7e35724ee3d56984148e41a6202d03b4bd02a'
dump_lines = DUMP.read_text(encoding='utf-8').replace('\r\n', '\n').split('\n')


def dump_page(number: int) -> list[str]:
    start = dump_lines.index(f'## PDF page {number}') + 1
    end = dump_lines.index(f'## PDF page {number + 1}')
    lines = dump_lines[start:end]
    while lines and not lines[-1].strip():
        lines.pop()
    return lines


document = pymupdf.open(PDF)
results = []
for number in PAGES:
    text_file, image_file = RAW / f'r11-kga705-2025-page-{number}.txt', RAW / f'r11-kga705-2025-page-{number}.png'
    assert not text_file.exists() and not image_file.exists(), f'already exists: {text_file}'
    page = document[number - 1]
    text = page.get_text()
    text_file.write_bytes(text.encode('utf-8'))
    page.get_pixmap(dpi=110).save(image_file)
    fresh = text.split('\n')
    while fresh and not fresh[-1].strip():
        fresh.pop()
    results.append({
        'pdf_page': number,
        'text_file': text_file.as_posix(),
        'text_sha256': hashlib.sha256(text_file.read_bytes()).hexdigest(),
        'image_file': image_file.as_posix(),
        'image_sha256': hashlib.sha256(image_file.read_bytes()).hexdigest(),
        'same_as_dump_except_trailing_blank_lines': fresh == dump_page(number),
    })
print(json.dumps({'pymupdf': pymupdf.VersionBind, 'pages': results}, ensure_ascii=False, indent=2))
