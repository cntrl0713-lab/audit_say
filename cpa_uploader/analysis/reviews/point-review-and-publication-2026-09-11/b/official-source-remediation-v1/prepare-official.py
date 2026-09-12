"""Local official PDF comparison and byte-preserving registration proposal. API zero."""
from pathlib import Path
from hashlib import sha256
import json
import re
from pypdf import PdfReader

OWNED = Path(__file__).resolve().parent
ROOT = OWNED.parents[5]
SOURCE = ROOT / 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources'
TARGET = 'cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt'
def digest(data): return sha256(data).hexdigest()
def rel(file): return file.relative_to(ROOT).as_posix()
def norm(text): return re.sub(r'\s', '', text)
def write(file, data):
    with file.open('xb') as output: output.write(data)

pdfs = {2025: SOURCE / 'kga-2025.pdf', 2026: SOURCE / 'kga-2026-full.pdf'}
texts = {year: SOURCE / f'kga-{year}-pymupdf-pages.txt' for year in pdfs}
readers = {year: PdfReader(file) for year, file in pdfs.items()}
pages = {}
for year, file in texts.items():
    text = file.read_bytes().decode('utf-8')
    pages[year] = {}
    for match in re.finditer(r'## PDF page (\d+)\r?\n([\s\S]*?)(?=## PDF page \d+\r?\n|\Z)', text):
        pages[year][int(match.group(1))] = {'text': match.group(2), 'source_char_start': match.start(2), 'source_char_end': match.end(2),
            'source_line_start': text[:match.start(2)].count('\n') + 1, 'source_line_end': text[:match.end(2)].count('\n') + 1}

# Complete PDF pages preserve document headers, footnotes, and cross-page paragraphs.
# Source reference proposals choose exact substring spans within this staged file.
stage_pages = [('402', [339, 340]), ('505', [403, 404]), ('700', [676, 677])]
comparison_pages = [(339,365),(340,366),(403,429),(404,430),(676,703),(677,704),(810,837),(812,839)]
records = []
for old, new in comparison_pages:
    row = {'pdf_2025_page': old, 'pdf_2026_page': new}
    for year, page in [(2025, old), (2026, new)]:
        actual = readers[year].pages[page - 1].extract_text()
        record = pages[year][page]
        row[str(year)] = {'page': page, 'pdf_text': actual, 'pdf_text_sha256': digest(actual.encode()),
            'preserved_extraction_text': record['text'], 'preserved_extraction_sha256': digest(record['text'].encode()),
            'nonwhitespace_equal_to_independent_pypdf': norm(actual) == norm(record['text']),
            **{key: value for key, value in record.items() if key != 'text'}}
    # Only folio numbers differ on these complete corresponding pages.
    strip_folio = lambda text: re.sub(r'\d+\s*/\s*(974|1001)', '', text)
    row['editions_equal_except_folio_and_whitespace'] = norm(strip_folio(row['2025']['pdf_text'])) == norm(strip_folio(row['2026']['pdf_text']))
    records.append(row)

header = '\n'.join([
    '# 한국공인회계사회 회계감사기준 전문 2025년 11월 개정 공식 원문 보충',
    '출처 등록 제안일: 2026-09-11. 아래 PDF 페이지 본문은 보존된 공식 전사에서 부분문자열 바이트 그대로 추출했다.',
    '공식 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06',
    f'출처 PDF: {rel(pdfs[2025])}; SHA256 {digest(pdfs[2025].read_bytes())}',
    f'출처 전사: {rel(texts[2025])}; SHA256 {digest(texts[2025].read_bytes())}',
    f'대조 PDF: {rel(pdfs[2026])}; SHA256 {digest(pdfs[2026].read_bytes())}',
    '대조 방법: 원 PDF를 pypdf로 새로 읽어 전사와 비공백 문자를 대조했고, 2026년 7월 전문의 대응 페이지도 비교했다.',
    '적용 범위: 2026-01-01 개시 보고기간을 전제로 한 기존 2027 CPA 배치 판본 가정을 유지한다. 최종 시험 판본의 별도 지정을 보증하지 않는다.',
    '보존 범위: 문단 전후의 머리말·각주·문맥을 삭제하거나 정답 문장으로 윤문하지 않았다. PDF PAGE 표지는 위치 메타데이터이다.',
    '',
])
stage = header
for standard, selected in stage_pages:
    stage += f'\n# KGA {standard}: 공식 PDF 본문\n'
    for page in selected:
        stage += f'\n## PDF PAGE {page}\n' + pages[2025][page]['text']
stage_file = OWNED / 'point-review-b-source-followup-2026-09-11.txt'
write(stage_file, stage.encode('utf-8'))
evidence = {'version': 1, 'api_calls': 0, 'source_method': 'original PDF independently read with pypdf; stored PyMuPDF page substrings preserved byte for byte',
    'new_official_files': [{'staged_file': rel(stage_file), 'target_file': TARGET, 'sha256': digest(stage_file.read_bytes()),
        'provenance': {'pdfs': [{'year': year, 'file': rel(file), 'sha256': digest(file.read_bytes())} for year, file in pdfs.items()],
            'extractions': [{'year': year, 'file': rel(file), 'sha256': digest(file.read_bytes())} for year, file in texts.items()],
            'page_groups': [{'standard': f'KGA {standard}', 'pages': selected} for standard, selected in stage_pages]}}],
    'page_comparisons': records,
    'all_pdf_transcriptions_equal_ignoring_whitespace': all(row[str(year)]['nonwhitespace_equal_to_independent_pypdf'] for row in records for year in [2025, 2026]),
    'all_corresponding_editions_equal_except_folio_and_whitespace': all(row['editions_equal_except_folio_and_whitespace'] for row in records)}
write(OWNED / 'official-pdf-evidence.json', (json.dumps(evidence, ensure_ascii=False, indent=2)+'\n').encode())
print(json.dumps({'staged_file': rel(stage_file), 'target_file': TARGET, 'sha256': digest(stage_file.read_bytes()),
    'comparisons': len(records), 'pdf_transcription_equal': evidence['all_pdf_transcriptions_equal_ignoring_whitespace'],
    'editions_equal': evidence['all_corresponding_editions_equal_except_folio_and_whitespace']}, ensure_ascii=False))
