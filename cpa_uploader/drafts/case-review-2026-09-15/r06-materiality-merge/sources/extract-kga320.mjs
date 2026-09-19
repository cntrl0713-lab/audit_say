// r06: KGA 320 문단 6·A11(2025 전문) 발췌본과 출처 계보를 만든다. 원문 행은 기존 PyMuPDF 페이지 텍스트에서 그대로 가져온다.
// render-kga320-pages.py로 같은 쪽을 다시 추출·렌더링한 raw 대조 파일이 먼저 있어야 한다. 기존 출력이 있으면 쓰지 않는다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r06-materiality-merge/sources/extract-kga320.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const DUMP = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt';
const PDF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf';
const DUMP_2026 = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const RAW = 'cpa_uploader/raw/originals/case-review-2026-09-15';
const OUT = `${RAW}/kga320-2025-excerpts.md`;
const PROVENANCE = `${RAW}/kga320-2025-excerpts.provenance.json`;
const REGISTERED = 'cpa_uploader/data/official/case-review-2026-09-15-kga320.md';
const URL = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const FRESH = {
    306: ['0b9480ad1f708bdc658fcb5828f97b4bf8f253c53edaa62848f1f4cf9ece6030', '27f2384d60dc41bf7cae64b77ed8d2c0145ccc94b9e7375e0e373d80f8b28700'],
    310: ['e4ce72bb39b3ee1c52f1ed6fb47201d012789137306f86e8bfe86fbbb5084dd5', 'a69a63e548a6f6933a566a2a1c50defd261f24211b47b594cc433149c765dc42'],
    311: ['988f903be7af5670b219bcf1dd7e684a6090eb054f7bee4947fb7601493f5a62', '9e486241f7471c8ad2d03f0688897001dd78744374c658ad9ad6a937bec028a3'],
};

assert.equal(sha(fs.readFileSync(DUMP)), 'b626436fcb11ce0c8a51e542d6e7e35724ee3d56984148e41a6202d03b4bd02a');
assert.equal(sha(fs.readFileSync(PDF)), 'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989');
assert.equal(sha(fs.readFileSync(DUMP_2026)), 'f0914795b909ea38e6ab2d4db83a7cc0e3519730ae30c7925fca034bf5975568');
const freshFiles = Object.entries(FRESH).flatMap(([page, [text, image]]) => {
    const files = [{ file: `${RAW}/kga320-2025-page-${page}.txt`, sha256: text }, { file: `${RAW}/kga320-2025-page-${page}.png`, sha256: image }];
    for (const entry of files) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256, entry.file);
    return files;
});
assert(!fs.existsSync(OUT) && !fs.existsSync(PROVENANCE) && !fs.existsSync(REGISTERED), 'outputs already exist');

// 페이지 텍스트는 CRLF로 저장되어 있으므로 행 끝 CR만 제거하고 행 끝 공백은 유지한다.
const lines = fs.readFileSync(DUMP, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const take = (start, end) => lines.slice(start - 1, end);
const expectLine = (number, text) => assert.equal(lines[number - 1].trimEnd(), text, `L${number}`);

expectLine(13148, '## PDF page 306');
expectLine(13163, '6.');
expectLine(13164, '감사계획 수립시, 감사인은 중요하다고 고려될 왜곡표시의 크기에 관한 판단을 내리게 된');
expectLine(13179, '그리고 그러한 미수정왜곡표시가 발생한 특수한 상황도 고려한다.4 (문단 A2 참조)');
expectLine(13180, '시행일');
expectLine(13189, '3 감사기준서 315 “기업과 기업환경 이해를 통한 중요왜곡표시위험의 식별과 평가” 문단 A134-A135 참고');
expectLine(13190, '4 감사기준서 450 문단 A21');
expectLine(13326, '## PDF page 310');
expectLine(13360, '특정 거래유형과 계정잔액 및 공시에 대한 중요성 수준 (문단 10 참조)');
assert(lines[13360].startsWith('A11. 그 왜곡표시가 재무제표 전체의 중요성보다는'), 'L13361');
expectLine(13364, '다.');
expectLine(13367, '## PDF page 311');
expectLine(13369, '311 / 974');
expectLine(13371, '법규 또는 해당 재무보고체계가 어떤 항목(예를 들어, 특수관계자와의 거래, 경영진');
expectLine(13378, '들어, 부문이나 유의적인 사업결합에 대한 공시)');
assert(lines[13378].startsWith('A12. '), 'L13379');

const selections = [
    { paragraph: '6', pdf_page: 306, ranges: [[13163, 13179]] },
    { paragraph: '6 footnotes 3·4', pdf_page: 306, ranges: [[13189, 13190]] },
    { paragraph: 'A11', pdf_page: '310-311', ranges: [[13361, 13364], [13370, 13378]] },
];
const range = (paragraph) => selections.find((s) => s.paragraph === paragraph).ranges.flatMap(([start, end]) => take(start, end));
const header = [
    `출처: 한국공인회계사회 2025년 개정 회계감사기준 전문 PDF 306·310·311쪽. 공식 URL: ${URL}`,
    '확인일: 2026-09-17. 2027년 CPA 시험 대비, 2026-01-01 개시 보고기간을 기본 사례로 적용. 2026 전문과 대조해 문단 6·A11의 본문은 같고 문단 6 각주 3의 감사기준서 315 제목만 달라짐. 추출 계보: cpa_uploader/raw/originals/case-review-2026-09-15/kga320-2025-excerpts.provenance.json',
];
const body = [
    '# KGA 320: 감사의 계획수립과 수행에 있어서의 중요성',
    '',
    ...header,
    '',
    '## PDF PAGE 306',
    ...range('6'),
    ' ',
    ...range('6 footnotes 3·4'),
    '',
    '## PDF PAGE 310',
    ...range('A11'),
    '',
].join('\n');
// questionSourceCatalog.mjs의 판본 설명은 앞 12줄 중 https?:|확인|개정|시행|Checked|출처를 포함한 줄이다.
const catalogHeader = body.split(/\r?\n/u).slice(0, 12).filter((line) => /https?:|확인|개정|시행|Checked|출처/iu.test(line));
assert.deepEqual(catalogHeader, header, 'catalog edition header must be exactly the provenance lines');

// 2026 전문 대조(PDF 332·336~337쪽).
const dump2026 = fs.readFileSync(DUMP_2026, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const joined2026 = (ranges) => ranges.flatMap(([start, end]) => dump2026.slice(start - 1, end)).join('\n').replace(/\s+/gu, '');
const joined2025 = (paragraph) => range(paragraph).join('\n').replace(/\s+/gu, '');
assert.equal(dump2026[14249].trimEnd(), '6.');
assert.equal(joined2025('6'), joined2026([[14250, 14266]]), '6 2026');
assert(dump2026[14447].startsWith('A11. 그 왜곡표시가'));
assert.equal(joined2025('A11'), joined2026([[14448, 14451], [14457, 14465]]), 'A11 2026');
assert.notEqual(joined2025('6 footnotes 3·4'), joined2026([[14276, 14277]]), 'footnote 3 title differs in 2026');

fs.writeFileSync(OUT, body, { flag: 'wx' });
fs.writeFileSync(REGISTERED, body, { flag: 'wx' });
const provenance = {
    source_file: DUMP,
    source_sha256: sha(fs.readFileSync(DUMP)),
    source_pdf: PDF,
    source_pdf_sha256: sha(fs.readFileSync(PDF)),
    source_pdf_raw_copy: 'cpa_uploader/raw/materials/verification/b6b3a965c25cdb5b/kga-2025.pdf',
    official_url: URL,
    official_url_record: 'cpa_uploader/drafts/frequency-priority-2026-09-10/sources/provenance.json (downloads[edition=2025], checked_at 2026-09-10T12:01:19Z)',
    edition: '2025',
    output_file: OUT,
    output_sha256: sha(fs.readFileSync(OUT)),
    registered_copy: REGISTERED,
    registered_sha256: sha(fs.readFileSync(REGISTERED)),
    selections,
    transformation: '원 페이지 텍스트의 CRLF 행 끝에서 CR만 제거하고 각 문단의 원문 문자·기호(글머리표 U+F0B7 포함)·행 끝 공백을 유지해 LF로 결합했다. KGA 제목, 출처·확인일 두 줄, 문단이 시작하는 PDF 쪽의 머리말(## PDF PAGE)을 추가했다. 쪽을 넘는 A11(310→311쪽)은 다음 쪽 머리말·쪽 번호 행을 빼고 이어 붙였다. 문단 6의 각주 3·4는 문단 바로 뒤에 한 줄 띄워 두었다. 소제목 행, 문단 5·7·8, A10·A12는 제외했다.',
    fresh_check: {
        method: 'PyMuPDF 1.28.2(uv 캐시, 오프라인)로 원본 PDF 306·310·311쪽을 다시 추출해 기존 페이지 텍스트의 해당 쪽과 비교했고(끝 빈 줄 외 동일), 같은 쪽을 110dpi 이미지로 렌더링해 문단 6(각주 3·4)과 A11을 육안 대조했다. 도구: cpa_uploader/drafts/case-review-2026-09-15/r06-materiality-merge/sources/render-kga320-pages.py',
        files: freshFiles,
    },
    edition_comparison_2026: {
        source_file: DUMP_2026,
        source_sha256: sha(fs.readFileSync(DUMP_2026)),
        lines: '문단 6 L14250-L14266, 각주 3·4 L14276-L14277 (PDF 332쪽); A11 L14448-L14451·L14457-L14465 (336~337쪽)',
        finding: '문단 6과 A11의 본문은 공백을 빼면 같다. 문단 6 각주 3의 감사기준서 315 제목이 “중요왜곡표시위험의 식별과 평가”로 바뀌었다. KGA 320 전체(문단 1~14, A1~A14)도 2025·2026 전문에서 각주의 KGA 315 제목 외에 같다. 사례의 20X1년(2026년 1월 1일 개시 보고기간)에는 2025 전문을 적용한다.',
    },
    catalog_edition_header: header,
    status: 'raw_preserved_and_registered',
};
fs.writeFileSync(PROVENANCE, JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
console.log({ output: OUT, sha256: provenance.output_sha256, registered: REGISTERED, same: provenance.output_sha256 === provenance.registered_sha256 });
