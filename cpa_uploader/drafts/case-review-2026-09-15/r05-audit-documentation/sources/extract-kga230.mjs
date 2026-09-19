// r05: KGA 230 문단 A4·A5·A12·A13·A15·A20(2025 전문) 발췌본과 출처 계보를 만든다. 원문 행은 기존 PyMuPDF 페이지 텍스트에서 그대로 가져온다.
// render-kga230-pages.py로 같은 쪽을 다시 추출·렌더링한 raw 대조 파일이 먼저 있어야 한다. 기존 출력이 있으면 쓰지 않는다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r05-audit-documentation/sources/extract-kga230.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const DUMP = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt';
const PDF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf';
const DUMP_2026 = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const RAW = 'cpa_uploader/raw/originals/case-review-2026-09-15';
const OUT = `${RAW}/kga230-2025-excerpts.md`;
const PROVENANCE = `${RAW}/kga230-2025-excerpts.provenance.json`;
const REGISTERED = 'cpa_uploader/data/official/case-review-2026-09-15-kga230.md';
const URL = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const FRESH = {
    74: ['3f4745fabe9f51e4282768a9d496c54c282d9ad95afafd3211053b0c039184cf', '8a7cfe49fafafe1aab228635f78831fb9bde4d4354c4c85962ec54b3c7baaa57'],
    76: ['af85ec3c646a4e7b30b0152fa0a4f22a851bdda319786319bf5dcc9845b59fcd', 'eba95cffd11e7e630f87e634c55fb8d430d019bac71182e14ccbfa55e5311842'],
    77: ['36a446be2d35ae08430a6080b5fe48bdf84b53cd0ed6817d2b21fd9ca865b18e', '12e924e964549c20a3a28ed852055b96255dd767e502e7be9c11c2313f99585f'],
    78: ['300f04aba2fe9a9c2d945ebe95a3ffafe725dfe338557109d52c89c5525cb395', 'e8c092db4105420e2ce32c3f1986269a213d3d3a58bcc259e01620bedad9d120'],
    79: ['24e81b6a4e1af2add5b50a6387d9bb37d0aeed70b0b6395d15b64be7614fbed0', '0a6556a24e2552f704836d0b0e45071fb813fc577aaf66d13db1a53fd18acd38'],
};

assert.equal(sha(fs.readFileSync(DUMP)), 'b626436fcb11ce0c8a51e542d6e7e35724ee3d56984148e41a6202d03b4bd02a');
assert.equal(sha(fs.readFileSync(PDF)), 'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989');
assert.equal(sha(fs.readFileSync(DUMP_2026)), 'f0914795b909ea38e6ab2d4db83a7cc0e3519730ae30c7925fca034bf5975568');
const freshFiles = Object.entries(FRESH).flatMap(([page, [text, image]]) => {
    const files = [{ file: `${RAW}/kga230-2025-page-${page}.txt`, sha256: text }, { file: `${RAW}/kga230-2025-page-${page}.png`, sha256: image }];
    for (const entry of files) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256, entry.file);
    return files;
});
assert(!fs.existsSync(OUT) && !fs.existsSync(PROVENANCE) && !fs.existsSync(REGISTERED), 'outputs already exist');

// 페이지 텍스트는 CRLF로 저장되어 있으므로 행 끝 CR만 제거하고 행 끝 공백은 유지한다.
const lines = fs.readFileSync(DUMP, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const take = (start, end) => lines.slice(start - 1, end);
const expectLine = (number, text) => assert.equal(lines[number - 1].trimEnd(), text, `L${number}`);

expectLine(3013, '## PDF page 74');
expectLine(3037, 'A4.');
expectLine(3040, '은 감사문서에 포함시킬 필요가 없다.');
expectLine(3041, 'A5.');
expectLine(3043, '되지 못하지만, 감사문서에 포함된 정보를 설명하거나 명확하게 하는 데는 유용할 수 있다.');
expectLine(3110, '## PDF page 76');
expectLine(3147, '테스트한 특정 항목이나 사항 및 작성자와 검토자의 식별(문단 9 참조)');
assert(lines[3147].startsWith('A12. 식별한 특성의 기록은'), 'L3148');
expectLine(3149, '무에 대한 책임감을 갖도록 하고 예외사항이나 불일치사항에 대한 조사를 용이하게 한다.');
expectLine(3151, '7 감사기준서 701 “감사보고서 핵심감사사항 커뮤니케이션”');
expectLine(3154, '## PDF page 77');
expectLine(3157, '77 / 974');
expectLine(3158, '특성의 식별은 감사절차 및 테스트한 항목이나 사항의 성격에 따라 다양할 것이다. 예를');
expectLine(3177, '을 실시한 장소와 시기를 기록할 수 있을 것이다.');
assert(lines[3177].startsWith('A13. 감사기준서 220은'), 'L3178');
expectLine(3182, '검토하였는지를 문서화하는 것을 의미한다.');
assert(lines[3188].startsWith('A15. 정보의 불일치에 대하여'), 'L3189');
expectLine(3190, '부정확한 문서나 교체된 문서를 보존하여야 한다는 것을 의미하는 것은 아니다.');
expectLine(3192, '8 감사기준서 220 문단 17');
expectLine(3195, '## PDF page 78');
assert(lines[3227].startsWith('A20. 예외 상황이란'), 'L3228');
expectLine(3229, '존재하였으며 만약 그 일자에 알려졌을 경우 재무제표를 수정하였거나, 감사인이 감사의견');
expectLine(3236, '## PDF page 79');
expectLine(3239, '79 / 974');
assert(lines[3239].startsWith('을 변형시켰을 수도 있는 사실이 포함된다.'), 'L3240');
expectLine(3242, '종책임을 진다.');
expectLine(3270, '12 감사기준서 560 “후속사건” 문단 14');
expectLine(3271, '13 감사기준서 220 문단 16');

const selections = [
    { paragraph: 'A4', pdf_page: 74, ranges: [[3037, 3040]] },
    { paragraph: 'A5', pdf_page: 74, ranges: [[3041, 3043]] },
    { paragraph: 'A12', pdf_page: '76-77', ranges: [[3148, 3149], [3158, 3177]] },
    { paragraph: 'A13', pdf_page: 77, ranges: [[3178, 3182]] },
    { paragraph: 'A13 footnote 8', pdf_page: 77, ranges: [[3192, 3192]] },
    { paragraph: 'A15', pdf_page: 77, ranges: [[3189, 3190]] },
    { paragraph: 'A20', pdf_page: '78-79', ranges: [[3228, 3229], [3240, 3242]] },
    { paragraph: 'A20 footnotes 12·13', pdf_page: 79, ranges: [[3270, 3271]] },
];
const range = (paragraph) => selections.find((s) => s.paragraph === paragraph).ranges.flatMap(([start, end]) => take(start, end));
const header = [
    `출처: 한국공인회계사회 2025년 개정 회계감사기준 전문 PDF 74·76·77·78·79쪽. 공식 URL: ${URL}`,
    '확인일: 2026-09-17. 2027년 CPA 시험 대비, 2026-01-01 개시 보고기간을 기본 사례로 적용. 2026 전문과 대조해 A4·A5·A12·A15와 A20 첫 문장은 같고, A13 첫 문장·각주와 A20 둘째 문장은 개정 220의 정합 개정으로 표현이 달라짐. 추출 계보: cpa_uploader/raw/originals/case-review-2026-09-15/kga230-2025-excerpts.provenance.json',
];
const body = [
    '# KGA 230: 감사문서',
    '',
    ...header,
    '',
    '## PDF PAGE 74',
    ...range('A4'),
    ...range('A5'),
    '',
    '## PDF PAGE 76',
    ...range('A12'),
    '',
    '## PDF PAGE 77',
    ...range('A13'),
    ' ',
    ...range('A13 footnote 8'),
    ...range('A15'),
    '',
    '## PDF PAGE 78',
    ...range('A20'),
    ' ',
    ...range('A20 footnotes 12·13'),
    '',
].join('\n');
// questionSourceCatalog.mjs의 판본 설명은 앞 12줄 중 https?:|확인|개정|시행|Checked|출처를 포함한 줄이다.
const catalogHeader = body.split(/\r?\n/u).slice(0, 12).filter((line) => /https?:|확인|개정|시행|Checked|출처/iu.test(line));
assert.deepEqual(catalogHeader, header, 'catalog edition header must be exactly the provenance lines');

// 2026 전문 대조(PDF 99·101~104쪽).
const dump2026 = fs.readFileSync(DUMP_2026, 'utf8').split('\n').map((line) => line.replace(/\r$/u, ''));
const joined2026 = (ranges) => ranges.flatMap(([start, end]) => dump2026.slice(start - 1, end)).join('\n');
const joined2025 = (paragraph) => range(paragraph).join('\n');
const same = (paragraph, ranges2026) => joined2025(paragraph).replace(/\s+/gu, '') === joined2026(ranges2026).replace(/\s+/gu, '');
assert(same('A4', [[4104, 4107]]), 'A4 2026');
assert(same('A5', [[4108, 4110]]), 'A5 2026');
assert(dump2026[4214].startsWith('A12. 식별한') && dump2026[4224].startsWith('특성의 식별은'));
assert(same('A12', [[4215, 4216], [4225, 4244]]), 'A12 2026');
assert(same('A15', [[4256, 4257]]), 'A15 2026');
assert(!same('A13', [[4245, 4249]]), 'A13 differs in 2026');
assert(joined2026([[4245, 4249]]).replace(/\s+/gu, '').endsWith(joined2025('A13').replace(/\s+/gu, '').slice(joined2025('A13').replace(/\s+/gu, '').indexOf('수행된감사업무를누가'))), 'A13 operative sentences unchanged');
assert(dump2026[4294].startsWith('A20. 예외 상황이란') && dump2026[4306].startsWith('을 변형시켰을'));
assert(!same('A20', [[4295, 4296], [4307, 4308]]), 'A20 differs in 2026');

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
    transformation: '원 페이지 텍스트의 CRLF 행 끝에서 CR만 제거하고 각 문단의 원문 문자·기호(글머리표 U+F0B7 포함)·행 끝 공백을 유지해 LF로 결합했다. KGA 제목, 출처·확인일 두 줄, 문단이 시작하는 PDF 쪽의 머리말(## PDF PAGE)을 추가했다. 쪽을 넘는 A12(76→77쪽)와 A20(78→79쪽)은 다음 쪽 머리말·쪽 번호 행을 빼고 이어 붙였다. 각주는 소유 문단 바로 뒤에 한 줄 띄워 두었다(A13 각주 8은 A15 앞으로 옮김). 소제목 행, A3·A6~A11·A14·A16~A19, 76쪽 각주 7(A10 소유)은 제외했다.',
    fresh_check: {
        method: 'PyMuPDF 1.28.2(uv 캐시, 오프라인)로 원본 PDF 74·76·77·78·79쪽을 다시 추출해 기존 페이지 텍스트의 해당 쪽과 비교했고(끝 빈 줄 외 동일), 같은 쪽을 110dpi 이미지로 렌더링해 A4·A5·A12·A13(각주 8)·A15·A20(각주 12·13)을 육안 대조했다. 도구: cpa_uploader/drafts/case-review-2026-09-15/r05-audit-documentation/sources/render-kga230-pages.py',
        files: freshFiles,
    },
    edition_comparison_2026: {
        source_file: DUMP_2026,
        source_sha256: sha(fs.readFileSync(DUMP_2026)),
        lines: 'A4 L4104-L4107, A5 L4108-L4110 (PDF 99쪽); A12 L4215-L4216·L4225-L4244 (101~102쪽); A13 L4245-L4249, A15 L4256-L4257 (102쪽); A20 L4295-L4296·L4307-L4308 (103~104쪽)',
        finding: 'A4·A5·A12·A15는 공백을 빼면 같다. A13은 첫 문장이 "감사기준서 220은 감사문서의 검토에 대한 요구사항과 지침을 포함한다"로 바뀌고 각주가 220 문단 29-34로 바뀌었으나, 개별 감사조서마다 검토 증거를 남길 필요는 없고 어떤 업무를 누가 언제 검토했는지 문서화한다는 문장은 같다. A20은 예외 상황의 정의(첫 문장)가 같고 둘째 문장에서 "업무수행이사는 그러한 변경에 대하여 최종책임을 진다"가 빠졌다. 사례의 20X1년(2026년 1월 1일 개시 보고기간)에는 2025 전문을 적용하며, 문항 판단에 쓰는 내용은 두 판본에서 같다.',
    },
    catalog_edition_header: header,
    status: 'raw_preserved_and_registered',
};
fs.writeFileSync(PROVENANCE, JSON.stringify(provenance, null, 2) + '\n', { flag: 'wx' });
console.log({ output: OUT, sha256: provenance.output_sha256, registered: REGISTERED, same: provenance.output_sha256 === provenance.registered_sha256 });
