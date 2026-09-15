// KGA 300 문단 3·13(2025 전문) 발췌본 v2와 출처 계보를 만든다. 원문 행은 기존 PyMuPDF 페이지 텍스트에서 그대로 가져온다.
// v1(extract-kga300-v1.mjs)과 달리 파일 머리에 판본 기록 줄을 두어 원자료 카탈로그(questionSourceCatalog.mjs)가 앞 12줄에서
// 판본 설명을 읽게 하고, 그 12줄 안에 들던 원문 소제목 “시행일” 행은 뺀다. raw의 v1 파일은 고치지 않고 v2 파일을 새로 쓴다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit/sources/extract-kga300.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const DUMP = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt';
const PDF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf';
const DUMP_2026 = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const RAW = 'cpa_uploader/raw/originals/case-review-2026-09-15';
const OUT = `${RAW}/kga300-2025-excerpts-v2.md`;
const PROVENANCE = `${RAW}/kga300-2025-excerpts-v2.provenance.json`;
const V1 = { file: `${RAW}/kga300-2025-excerpts.md`, sha256: '8a51038d8b6e82a81b7ac0c4bea4aae7b89612f8995c5f19b43e0ade2a62e3b6' };
const REGISTERED = 'cpa_uploader/data/official/case-review-2026-09-15-kga300.md';
const URL = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';

assert.equal(sha(fs.readFileSync(DUMP)), 'b626436fcb11ce0c8a51e542d6e7e35724ee3d56984148e41a6202d03b4bd02a');
assert.equal(sha(fs.readFileSync(PDF)), 'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989');
assert.equal(sha(fs.readFileSync(V1.file)), V1.sha256, 'raw v1 must stay unchanged');
assert(!fs.existsSync(OUT) && !fs.existsSync(PROVENANCE), 'v2 raw outputs already exist');
// 페이지 텍스트는 CRLF로 저장되어 있으므로 행 끝 CR만 제거하고 행 끝 공백은 유지한다.
const lines = fs.readFileSync(DUMP, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const take = (start, end) => lines.slice(start - 1, end);
const expectLine = (number, text) => assert.equal(lines[number - 1].trimEnd(), text, `L${number}`);

// 2025 전문: PDF 180쪽 문단 3(시행일 소제목 제외), PDF 182쪽 초도감사 시 추가적인 고려사항(문단 13)과 같은 쪽 각주 7.
expectLine(7388, '## PDF page 180');
expectLine(7414, '시행일');
expectLine(7415, '3.');
expectLine(7417, '행된다.');
expectLine(7482, '## PDF page 182');
expectLine(7501, '초도감사 시 추가적인 고려사항');
expectLine(7509, '여 전임감사인과 커뮤니케이션을 함 (문단 A22 참조)');
expectLine(7524, '7 감사기준서 220 문단 12-13');
const selections = [
    { start_line: 7415, end_line: 7417, paragraph: '3', pdf_page: 180 },
    { start_line: 7501, end_line: 7509, paragraph: '13', pdf_page: 182 },
    { start_line: 7524, end_line: 7524, paragraph: '13 footnote 7', pdf_page: 182 },
];
const header = [
    `출처: 한국공인회계사회 2025년 개정 회계감사기준 전문 PDF 180·182쪽. 공식 URL: ${URL}`,
    '확인일: 2026-09-15. 2027년 CPA 시험 대비, 2026-01-01 개시 보고기간을 기본 사례로 적용. 2026 전문은 같은 요구를 문단 12로 옮김(개정 220의 정합 개정, 요구 내용 동일). 추출 계보: cpa_uploader/raw/originals/case-review-2026-09-15/kga300-2025-excerpts-v2.provenance.json',
];
const body = [
    '# KGA 300: 재무제표감사의 계획수립',
    '',
    ...header,
    '',
    '## PDF page 180',
    ...take(7415, 7417),
    '',
    '## PDF page 182',
    ...take(7501, 7509),
    ' ',
    ...take(7524, 7524),
    '',
].join('\n');
// questionSourceCatalog.mjs의 판본 설명은 앞 12줄 중 https?:|확인|개정|시행|Checked|출처를 포함한 줄이다.
const catalogHeader = body.split(/\r?\n/u).slice(0, 12).filter((line) => /https?:|확인|개정|시행|Checked|출처/iu.test(line));
assert.deepEqual(catalogHeader, header, 'catalog edition header must be exactly the provenance lines');

// 2026 전문 대조: 개정 220의 정합 개정으로 같은 요구가 문단 12(PDF 207쪽)로 번호가 바뀌었다.
const dump2026 = fs.readFileSync(DUMP_2026, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const at2026 = (number) => dump2026[number - 1].trimEnd();
assert.equal(at2026(8570), '초도감사 시 추가적인 고려사항');
assert.equal(at2026(8571), '12.');
assert.equal(at2026(8572), '감사인은 초도감사를 착수하기 전에 다음의 절차를 수행하여야 한다.');
assert.equal(at2026(8578), '여 전임감사인과 커뮤니케이션을 함 (문단 A22 참조)');

fs.writeFileSync(OUT, body, { flag: 'wx' });
fs.writeFileSync(REGISTERED, body);
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
    supersedes: { ...V1, provenance: `${RAW}/kga300-2025-excerpts.provenance.json`,
        reason: 'v1에는 판본 기록 줄이 없어 원자료 카탈로그가 앞 12줄의 원문 소제목 “시행일”을 판본 설명으로 표시했다. 인용 원문 행(문단 3 본문·문단 13·각주 7)은 v1과 같다.' },
    selections,
    transformation: '원 페이지 텍스트의 CRLF 행 끝에서 CR만 제거하고 문단 3 본문과 문단 13의 원문 문자·기호·행 끝 공백을 유지해 LF로 결합했다. KGA 제목, 출처·확인일 두 줄, PDF 페이지 머리말을 추가했다. 문단 13의 각주 7(같은 PDF 182쪽 하단)은 문단 뒤에 한 줄 띄워 배치했다. 쪽 머리말·쪽 번호 행, 문단 3의 소제목 “시행일”, 문단 10~12와 적용자료 A1 이하는 제외했다.',
    fresh_check: {
        method: 'PyMuPDF 1.26.6로 원본 PDF 180·182쪽을 다시 추출해 기존 페이지 텍스트의 해당 쪽과 비교(끝 빈 줄만 다름)하고, 같은 쪽을 110dpi 이미지로 렌더링해 문단 3·13과 각주 7을 육안 대조했다(v1과 같은 확인).',
        files: [`${RAW}/kga300-2025-page-180.txt`, `${RAW}/kga300-2025-page-180.png`, `${RAW}/kga300-2025-page-182.txt`, `${RAW}/kga300-2025-page-182.png`],
    },
    edition_comparison_2026: {
        source_file: DUMP_2026,
        source_sha256: sha(fs.readFileSync(DUMP_2026)),
        lines: 'L8570-L8578 (PDF 207쪽)',
        finding: '2026 전문은 같은 요구를 문단 12로 두고 (a)의 "특정 감사업무"를 "감사업무"로, 각주를 감사기준서 220 문단 22-24로 바꾸었다. 개정 220의 정합 개정에 따른 번호·표현 변경이며 초도감사 착수 전 수임 절차와 전임감사인과의 커뮤니케이션이라는 요구 내용은 같다. 사례의 20X1년(2026년 1월 1일 개시 보고기간)에는 2025 전문 문단 13을 적용한다.',
    },
    catalog_edition_header: header,
    status: 'raw_preserved_registration_by_root_pending',
};
fs.writeFileSync(PROVENANCE, JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
console.log({ output: OUT, sha256: provenance.output_sha256, registered: REGISTERED, same: provenance.output_sha256 === provenance.registered_sha256 });
