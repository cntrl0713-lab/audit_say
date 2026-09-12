import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// This is a source extraction, not a new question bank or an approval of the
// textbooks' answers. All evidence is a contiguous, unmodified source span.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const base = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/';
const files = ['기출문제_연도별_해설_A.md', '기출문제_연도별_해설_B.md', '기출문제_주제별_해설.md'];
const indexPages = [11, 69, 125, 175, 221, 267, 317, 367, 413, 465, 507, 551];
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const documents = files.map((name) => {
  const file = base + name;
  const bytes = fs.readFileSync(path.join(root, file));
  const text = bytes.toString('utf8');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const pages = new Map();
  const pageAt = []; let page = 0;
  lines.forEach((line, i) => {
    const m = line.match(/^## 원문 페이지 (\d+)/);
    if (m) { page = Number(m[1]); pages.set(page, { start: i + 1, end: lines.length }); }
    pageAt[i + 1] = page;
  });
  const values = [...pages.values()];
  values.forEach((entry, i) => { if (values[i + 1]) entry.end = values[i + 1].start - 1; });
  return { file, bytes, text, newline, lines, pages, pageAt };
});
const [a, b, topical] = documents;
if (sha(a.bytes) !== 'f41650f55dd145a5f591232de0eb6ce9a70bd4f0a87e70daf30b00ed07e61384') {
  throw new Error('A source edition changed: review numbered-question mappings, manual spans and curated requirements before regenerating.');
}
const records = []; const unresolved = [];
function span(doc, start, end) {
  if (start < 1 || end < start || end > doc.lines.length) throw new Error(`Invalid span ${doc.file}:${start}-${end}`);
  return { source: { file: doc.file, start_line: start, end_line: end, page: doc.pageAt[start] }, text: doc.lines.slice(start - 1, end).join(doc.newline) };
}
function issue(doc, start, end, reason) { unresolved.push({ ...span(doc, start, end).source, reason }); }
function clean(s) { return s.replace(/\s+/g, ' ').replace(/^[•·]\s*/, '').trim(); }
function topicOf(s) {
  // Priority matters for overlapping vocabulary, e.g. component materiality.
  const rules = [
    ['02', /전문가적 의구심|전문가적 판단/],
    ['06', /위험평가절차.*식별|위험평가절차.*평가 절차/],
    ['07', /이전의 감사에서 입수된 감사증거의 이용/],
    ['17', /내부회계|통합감사|중요한 취약점/], ['18', /소규모기업/],
    ['14', /그룹|부문감사|부문재무|부문중요|유의적.*부문|유의적.*부분.*업무유형|연결재무/],
    ['19', /중간재무제표|반기재무제표|재무제표 검토|검토보고|인증업무개념|합의된 절차|추정재무제표/],
    ['16', /핵심감사사항|유의적감사인주의|강조사항|기타사항|기타정보|비교정보|비교재무|대응수치|close ?call|clo뚀/],
    ['08', /경영진측 전문가|경영진 측 전문가/],
    ['01', /독립성|윤리|안전장치|훼손위협|훼손 위협|품질|자문|이해상충|제2의견|제2 의견|감사보수|성공보수|손해배상|감사인.*책임한계|감사인의 책임|감사인의 적격성|비밀유지|공인회계사 광고|감리제도/],
    ['03', /수임|선임|감사계약|감사를 위한 전제|감사.*전제조건|교체제도|등록제도|비감사업무|감사인.*지정|감사인 유지제도/],
    ['13', /서비스조직|서비스감사인|유형 ?[12].?보고서|감사인측 전문가|경영진측 전문가|외부전문가|전문가 활용|전문가.*(업무|정의)|내부감사기능|내부감사 기능/],
    ['11', /회계추정|추정불확실|특수관계|경영진.*편의/],
    ['12', /후속사건|계속기업|계속기 업|계존유의|경영진의 예비평가|재무제표에 수정이나 공시가 요구되는 사건|서면진술|왜곡표시.*집계|미수정왜곡|미수정 왜곡|식별된 왜곡|왜곡표시(?!위험).*평가/],
    ['10', /표본|표집|PPS|추출간격|추출법|변이로 밝혀진|이탈.*공통된 특징|투영|추정왜곡표시상한|허용이탈|모집단|전수조사|분석적절차|분석적 절차/],
    ['09', /재고|실사|기초잔액|외부조회|적극적 조회|소극적 조회|조회서|소송|배상청구/],
    ['05', /부정|통제무력화|저널 엔트리|지배기구|감사위원회|커뮤니케이션|법규|법률|보고의무|통제미비점|통제 미비점|회계부정|외감법/],
    ['04', /중요성|감사조서|감사문서|문서화|감사계획|계획수립|감사전략/],
    ['06', /고유위험|위험평가|위험 평가|중요왜곡표시\s*위험.*(구성|식별|평가|사례)|유의적 위험.*(판단|식별)|통제환경|내부통제.*(구성|미비|설계|파악|이해)|정보처리통제|IT통제|IT 통제|정보기술|통제활동|전산내부통제|컴퓨터 자체감사|전산감사|일반통제/],
    ['07', /통제테스트|통제 테스트|운영효과성 평가|유의적 위험.*(대응|절차)|중요왜곡표시위험에 대처|실증절차|세부테스트|전반적 대응|추가감사절차|추가 감사절차|실증적 감사|실증적절차|절차.*(성격|시기|범위)/],
    ['08', /감사증거|생산한 정보|IPE|감사기술|감사기법|경영진주장|경영진 주장|실재성|완전성|기간귀속|수익인식|질문|현금|매출|매입|유형자산|차입금/],
    ['02', /고유한계|합리적.*확신|절대적인 확신|합리적인 시간|감사인을 비판|전문가적 의구심|전문가적 판단|감사위험|적발위험|회계감사.*(개요|목적|기본)|적정의견.*도산|감사기준.*이탈/],
    ['15', /감사의견|감사보고|적정의견|한정의견|의견거절|부적정의견/],
  ];
  if (/데이터베이스|기본키|외래키|JOIN|무결성|SQL/.test(s) && !/일반통제|통제사항/.test(s)) return null;
  return rules.find(([, pattern]) => pattern.test(s))?.[0] || null;
}
function kindOf(s) {
  if (/계산|산출|상한액|표본규모.*결정/.test(s)) return 'calculation';
  if (/차이|비교|구분|관계/.test(s)) return 'comparison';
  if (/정의|의미/.test(s)) return 'definition';
  if (/이유|효익|목적|근거/.test(s)) return 'reason';
  if (/판단|적절|여부|가능|결론|수용|의견|오류 찾기/.test(s)) return 'judgment';
  if (/절차|테스트|대응|조치|문서화|커뮤니케이션|통제|작성|검토|평가/.test(s)) return 'procedure';
  if (/기재|종류|구성|사항|요소|기준|조건/.test(s)) return 'list';
  return 'other';
}
function indexElements(raw) {
  // Only explicit bullet boundaries split a textbook label; commas and ordinary
  // words are not independently counted requirements.
  const body = raw.replace(/^\s*\d+(?:\s+\d+)?(?:-\d+\))?\s+(?:[Oo0]\s*)+/, '');
  const labels=[];let current='',depth=0;
  for(const line of body.split(/\r?\n/)) {
    const bullet=/^\s*•/.test(line);
    const stripped=line.replace(/^\s*•\s*/, '');
    if(bullet && current && depth<=0 && !/^(이들이|이러한|이들 |그 |평가 및)/.test(stripped)) {labels.push(clean(current));current='';}
    current += `${current ? ' ' : ''}${stripped}`;
    for(const c of stripped) {if(c==='(')depth++;else if(c===')')depth--;}
  }
  if(current.trim())labels.push(clean(current));
  return labels.filter(Boolean).map(label => ({ label, topic_id: topicOf(label), kind: kindOf(label) }));
}
function add(doc, start, end, role, origin, elements, status = 'extracted', notes = []) {
  const value = span(doc, start, end);
  const record = { id: `past-${sha(`${doc.file}:${start}:${end}:${role}`).slice(0, 20)}${origin.item ? `-item-${origin.item}` : ''}`, ...value, source_role: role, origin, elements,
    status: !elements.length ? 'needs_review' : status,
    notes: [...notes,...(elements.some(e=>e.topic_id===null)?['요구 자체는 원문에 보존되어 있으나 기존 19개 감사 주제로 분류하지 못한 요소가 있음. 미분류와 발문 미확정을 구분함.']:[])] };
  const context=notes.map(note=>note.match(/^문제 공통지문 범위: (.+):(\d+)-(\d+)\./)).find(Boolean);
  if(context && context[1]===doc.file && Number(context[3])>=Number(context[2])) {
    record.context_source=span(doc,Number(context[2]),Number(context[3])).source;
  }
  records.push(record); return record;
}
const origin = (year, problem, subquestion, item = null) => ({ kind: 'cpa_exam', year, problem: String(problem), subquestion: String(subquestion), item });
const originKey = o => `${o.year}:${o.problem}:${o.subquestion}:${o.item || ''}`;

// 2019's table was extracted by columns. These spans were reconciled against the
// actual questions on pp318–362, not guessed from the displaced number column.
const index2019 = [
  [1,1,12489,12489],[1,2,12490,12490],[1,3,12491,12491],[1,4,12492,12492],[1,5,12493,12494],
  [2,1,12495,12495],[2,2,12496,12496],[2,3,12497,12498],[2,4,12499,12499],[2,5,12500,12500],[2,6,12501,12501],
  [3,1,12502,12502],[3,2,12503,12503],[3,3,12504,12504],[3,4,12505,12505],
  [4,1,12506,12506],[4,2,12507,12507],[4,3,12508,12510],[4,4,12511,12512],
  [5,1,12513,12514],[5,2,12515,12515],[5,3,12516,12516],[5,4,12517,12517],
  [6,1,12518,12518],[6,2,12519,12520],[6,3,12521,12522],[6,4,12523,12523],[6,5,12524,12525],[6,6,12526,12526],
  [7,1,12527,12528],[7,2,12529,12529],[8,1,12530,12531],[8,2,12532,12533],[8,3,12534,12534],[8,4,12535,12535],
];
function extractIndexes() {
  for (const [offset, page] of indexPages.entries()) {
    const year = 2025 - offset;
    if (year === 2019) {
      if (a.lines[12488] !== '• 상황별 윤리강령 훼손과 위협' || a.pageAt[12535] !== 317) throw new Error('2019 reviewed table spans changed; recheck source');
      for (const [p,q,start,end] of index2019) add(a,start,end,'author_index',origin(year,p,q),indexElements(span(a,start,end).text),'extracted',[
        '2019 표의 열 분리 때문에 실제 본문 문제 1–8·물음 35개와 대조하여 원시험 번호를 복원함.',
        '교재 저자의 관련 주제 요약이다. 실제 발문 또는 독립적인 추가 출제 횟수가 아니다.',
        '암기형·사례형·계산/논리형 표식은 열 위치가 소실되어 확정하지 않음.',
      ]);
      continue;
    }
    const range = a.pages.get(page); let problem = null; let active = null;
    const close = end => {
      if (!active) return;
      while (end > active.start && !a.lines[end-1].trim()) end--;
      add(a,active.start,end,'author_index',origin(year,active.problem,active.sub,active.item),indexElements(span(a,active.start,end).text),'extracted',[
        '교재 저자의 물음별 관련 주제 요약이다. 실제 발문 또는 독립적인 추가 출제 횟수가 아니다.',
        '암기형·사례형·계산/논리형 표식은 열 위치가 소실되어 확정하지 않음.',
        ...(active.item ? ['표의 3-1)/3-2)는 2015 문제 7 물음 3의 하위 계산·판단 요구이다. 독립 물음 2개로 세지 않음.'] : []),
      ]); active = null;
    };
    let started = false;
    for (let n = range.start; n <= range.end; n++) {
      const line = a.lines[n-1].trim();
      if (line === '관련 주제') { started = true; continue; }
      if (!started) continue;
      const combined = line.match(/^(\d+)\s+(\d+)\s+[Oo0](?:\s|$)/);
      const simple = line.match(/^(\d+)(?:-(\d+)\))?\s+[Oo0](?:\s|$)/);
      if (combined || simple) {
        close(n-1);
        if (combined) problem = combined[1];
        if (!problem) throw new Error(`Missing problem at ${n}`);
        active = { start:n, problem, sub: combined ? combined[2] : simple[1], item: combined ? null : simple[2] || null };
      } else if (/^\d+$/.test(line)) { close(n-1); problem = line; }
    }
    close(range.end);
  }
}

extractIndexes();

// Additional question extraction is deliberately conservative: answer sections
// and unidentifiable question/column boundaries remain explicit review items.
const problemPages = {
  2025:[12,20,27,33,39,42,47,54,58,62], 2024:[70,80,84,89,94,102,105,109,114,118],
  2023:[126,135,141,145,147,151,155,159,163,167], 2022:[176,182,190,195,201,203,208,211,214],
  2021:[222,229,235,239,243,249,253,257], 2020:[268,273,276,283,287,292,300,304,308],
  2019:[318,325,332,335,342,349,358,361], 2018:[368,374,382,393,398,402,405,409],
  2017:[414,419,426,432,438,443,454,459], 2016:[466,471,473,475,483,488,494,497,502],
  2015:[508,512,517,522,527,532,538,545], 2014:[552,558,562,567,570,574,582,590],
};
const indexes = [...records];
// The author table compresses this whole five-part reporting problem into one
// row. These four actual printed subquestions must not disappear with the index.
const additionalBodies=[
  {origin:origin(2014,5,3),start:22636,end:22637,contextStart:22584,contextEnd:22593},
  {origin:origin(2016,7,2),start:19622,end:19626,contextStart:19604,contextEnd:19617},
  {origin:origin(2016,7,3),start:19627,end:19629,contextStart:19604,contextEnd:19617},
  {origin:origin(2016,7,4),start:19630,end:19633,contextStart:19604,contextEnd:19617},
  {origin:origin(2016,7,5),start:19646,end:19649,contextStart:19604,contextEnd:19617},
];
const fineElements = new Map([
  ['2025:1:3:', [['업무품질관리검토자가 유의적 판단·결론을 객관적으로 평가할 때 수행하는 절차를 제시된 업무수행이사와의 논의 예시를 제외하고 두 가지 서술','01','procedure']]],
  ['2025:1:4:', [['업무품질관리검토와 관련하여 업무수행이사가 수행할 절차를 제시된 검토자와의 논의 예시를 제외하고 두 가지 서술','01','procedure']]],
  ['2025:1:5:', [['감사업무의 자문과 관련하여 업무수행이사가 수행해야 하는 절차 두 가지 서술','01','procedure']]],
  ['2025:4:3:', [
    ['감사보고서일 후 보고서 전달 전 수정 원인이 될 사실을 알게 된 경우 감사인의 책임 성격 판단','12','judgment'],
    ['감사보고서일 후 알게 된 수정 원인이 될 사실에 관하여 경영진 등과 토의하고 재무제표 수정 필요성 및 경영진 처리계획을 확인하는 절차','12','procedure'],
    ['후속사건으로 재무제표가 수정되는 경우 해당 수정사항에 한정된 추가일자 또는 수행범위 설명을 포함한 감사보고서 수정방법','12','procedure'],
  ]],
]);
const curatedKeys=new Set();
for(const name of fs.readdirSync(here).filter(name=>/^past-exam-curated-\d{4}-\d{4}\.mjs$/.test(name)).sort()) {
  const {curated}=await import(new URL(name,import.meta.url).href);
  for(const [key, elements] of Object.entries(curated)) {
    if(curatedKeys.has(key))throw new Error(`Duplicate reviewed question requirements: ${key}`);
    if(!indexes.some(r=>originKey(r.origin)===key) && !additionalBodies.some(r=>originKey(r.origin)===key))throw new Error(`Unknown reviewed question: ${key}`);
    curatedKeys.add(key);fineElements.set(key,elements);
  }
}
function elementsFor(index) {
  return fineElements.has(originKey(index.origin)) ? fineElements.get(originKey(index.origin)).map(([label,topic_id,kind])=>({label,topic_id,kind})) : structuredClone(index.elements);
}
function subMarker(line) {
  return line.match(/^[^가-힣\n]{0,5}(?:물|결)\s*음\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*[）)\]]?/);
}
const answerCue = line => /^[^가-힣]*답안(?:근거)?\s*$/.test(line.trim()) || /^\s*[©ⓒ]\s*답안/.test(line);
function trimEnd(doc,start,end) {
  while(end>start && (!doc.lines[end-1].trim() || /^## 원문 페이지|^\d[\d\s-]*$|제\d+회 공인회계사.*시험 문제/.test(doc.lines[end-1]))) end--;
  return end;
}
function extractABodies() {
  for(const [yearString, starts] of Object.entries(problemPages)) {
    const year=Number(yearString); const nextIndex=indexPages[2025-year+1] || 597;
    for(const [pi,page] of starts.entries()) {
      const problem=String(pi+1), start=a.pages.get(page).start;
      const end=(a.pages.get(starts[pi+1] || nextIndex)?.start || a.lines.length+1)-1;
      const expected=indexes.filter(r=>r.origin.year===year && r.origin.problem===problem);
      if(!expected.length) throw new Error(`Missing index problem ${year}:${problem}`);
      let cutoff=end+1;
      for(let n=start;n<=end;n++) if(answerCue(a.lines[n-1])) {cutoff=n;break;}
      const markers=[];
      const repairedNumbers={21927:'1',21933:'3',5108:'6'};
      for(let n=start;n<cutoff;n++) {const m=subMarker(a.lines[n-1]);if(m || repairedNumbers[n])markers.push({start:n,sub:repairedNumbers[n] || m[1],item:m?.[2] || null});}
      // A repeated subquestion number before the answer symbol is also an answer
      // boundary. Do not ingest the repeated answers as new questions.
      const used=new Set();
      for(const marker of markers) {const key=`${marker.sub}:${marker.item || ''}`;if(used.has(key)){cutoff=Math.min(cutoff,marker.start);break;}used.add(key);}
      const first=markers.filter(m=>m.start<cutoff);
      for(const marker of first)if(!expected.some(r=>r.origin.subquestion===marker.sub) && !additionalBodies.some(r=>r.origin.year===year&&r.origin.problem===problem&&r.origin.subquestion===marker.sub)) {
        issue(a,marker.start,marker.start,`저자표에 없는 본문 물음 번호 후보 ${year}:${problem}:${marker.sub}. 발문·해설 경계 확인 필요.`);
      }
      if(expected.length===1 && !first.length) {
        let questionStart=start+1;
        while(questionStart<cutoff && !/[가-힣]{3}/.test(a.lines[questionStart-1])) questionStart++;
        if(cutoff<=end && /서술하|기재하|답하|계산하|설명하/.test(a.lines.slice(questionStart-1,cutoff-1).join(' '))) {
          const row=expected[0];
          add(a,questionStart,trimEnd(a,questionStart,cutoff-1),'question',structuredClone(row.origin),elementsFor(row),'extracted',[
            `원시험 물음 1개짜리 문제. author_index ${row.id}와 문제 경계를 대조함.`,
            '구체적 하위 항목/공통지문을 포함한 발문 보존. extracted는 의미·정답 검수 완료를 뜻하지 않음.',
          ]);
          continue;
        }
      }
      for(const row of expected) {
        const reviewedSpans={
          '2015:7:2:':[21417,21419],
          '2015:7:3:1':[21420,21433],
          '2015:7:3:2':[21420,21433],
          '2016:6:4:':[19471,19474],
          '2019:8:4:':[14324,14328],
          '2021:6:1:':[9770,9773],
          '2021:6:2:':[9774,9781],
          '2020:9:3:':[12061,12080],
          '2020:9:4:':[12081,12110],
          '2022:9:1:':[8286,8302],
          '2022:4:1:':[7521,7524],
          '2023:2:1:':[5073,5075],
          '2023:2:2:':[5076,5081],
          '2023:3:3:':[5356,5377],
          '2023:6:1:':[5683,5686],
          '2023:9:2:':[6264,6264],
          '2025:2:6:':[650,673],
          '2024:8:2:':[4100,4100],
        };
        const reviewed=reviewedSpans[originKey(row.origin)];
        if(reviewed) {add(a,...reviewed,'question',structuredClone(row.origin),elementsFor(row),'extracted',[
          `열 추출로 번호·답안 표식과 요구문의 순서가 어긋난 구간이다. 실제 요구문과 A 저자표 ${row.id}를 읽고 요구문 범위를 따로 확정함.`,
          `문제 공통지문 범위: ${a.file}:${start}-${(first[0]?.start || reviewed[0])-1}. 앞선 발문 및 공통조건을 함께 참조함.`,
          curatedKeys.has(originKey(row.origin))?'공통지문과 실제 발문을 대조하여 요구를 세분화함. 정답의 정확성 검수와는 별개임.':'교재 요약 기반 요소. 의미·정답 검수 완료를 의미하지 않음.',
        ]);continue;}
        let marker=first.find(m=>m.sub===row.origin.subquestion && m.item===row.origin.item);
        if(!marker && row.origin.item) marker=first.find(m=>m.sub===row.origin.subquestion);
        if(!marker) {issue(a,start,end,`${year} 문제 ${problem} 물음 ${row.origin.subquestion}${row.origin.item?'-'+row.origin.item:''}: 실제 발문 번호/답안 경계 OCR 확인 필요. 저자 표는 ${row.id}에 보존.`);continue;}
        let stop=first.find(m=>m.start>marker.start)?.start || cutoff;
        // A source paragraph announcing the next questions is shared context,
        // not another requirement of the preceding subquestion.
        for(let n=marker.start+1;n<stop;n++) if(/^(?:※\s*)?다음(?:은|의)?\s*.*물음.*(?:관련|대한)/.test(a.lines[n-1])) {stop=n;break;}
        const raw=span(a,marker.start,trimEnd(a,marker.start,stop-1));
        const imperative=curatedKeys.has(originKey(row.origin)) || /서술하|기재하|기술하|답하|계산하|설명하|적으시오|작성하|제시하|선택하|판단하|구하시오|지적하|열거하|쓰시오|고르시오/.test(raw.text.replace(/\s/g,''));
        if(/^물음\d+$/.test(normalize(raw.text))) {issue(a,raw.source.start_line,raw.source.end_line,`${year}:${problem}:${row.origin.subquestion}: 발문 없이 번호만 남아 question으로 추출하지 않음.`);continue;}
        add(a,raw.source.start_line,raw.source.end_line,'question',structuredClone(row.origin),elementsFor(row),imperative?'extracted':'needs_review',[
          `동일 원시험의 author_index ${row.id}와 연결. 요약표와 본문은 추가 출제로 중복 집계하지 않음.`,
          `문제 공통지문 범위: ${a.file}:${start}-${(first[0]?.start || cutoff)-1}. 발문의 '위 자료'는 이 문맥과 함께 해석해야 함.`,
          curatedKeys.has(originKey(row.origin))?'공통지문과 실제 발문을 대조하여 요구를 세분화함. 정답의 정확성 검수와는 별개임.':'요소는 저자 요약을 보존하며 세부 항목 의미분해는 아직 완료되지 않음.',
          ...(row.origin.item?['동일 물음 본문을 공유하는 하위 항목. item 단위 계산/판단 요구를 원 물음과 구분함.']:[]),
          ...(!imperative?['이 span에서 완결된 요구문을 확인하지 못함. 이어지는 OCR/본문 검토 필요.']:[]),
        ]);
      }
    }
  }
}
extractABodies();
for(const item of additionalBodies) {
  add(a,item.start,item.end,'question',item.origin,fineElements.get(originKey(item.origin)).map(([label,topic_id,kind])=>({label,topic_id,kind})),'extracted',[
    item.origin.year===2016?'저자 요약표는 문제 7 전체를 물음 1행으로 축약하지만 실제 본문은 물음 1–5다. 독립 요구문과 번호를 원문 대조하여 추가함.':'저자 요약표에서 생략된 실제 물음 번호와 요구문을 원문 대조하여 추가함.',
    `문제 공통지문 범위: ${a.file}:${item.contextStart}-${item.contextEnd}. 공통 지시와 중요성 기준을 함께 참조함.`,
    '공통지문과 실제 발문을 대조하여 요구를 세분화함. 정답의 정확성 검수와는 별개임.',
  ]);
}

// Some later subquestions introduce a new shared case after earlier questions.
// Link the nearest explicitly announced shared block, not only the problem's
// first paragraph (e.g. the PPS data following an earlier controls question).
for(const record of records.filter(r=>r.source.file===a.file&&r.source_role==='question')) {
  const problemStart=a.pages.get(problemPages[record.origin.year][Number(record.origin.problem)-1]).start;
  let sharedStart=null;
  for(let n=problemStart;n<record.source.start_line;n++)if(/^(?:※\s*)?다음(?:은|의)?\s*.*물음.*(?:관련|대한)/.test(a.lines[n-1]))sharedStart=n;
  if(sharedStart===null)continue;
  let sharedEnd=record.source.start_line-1;
  for(let n=sharedStart+1;n<record.source.start_line;n++)if(subMarker(a.lines[n-1])){sharedEnd=n-1;break;}
  if(sharedEnd<sharedStart)continue;
  record.context_source=span(a,sharedStart,sharedEnd).source;
  const note=`문제 공통지문 범위: ${a.file}:${sharedStart}-${sharedEnd}. 이 물음에 앞서 명시된 공통조건을 함께 참조함.`;
  record.notes=record.notes.filter(note=>!note.startsWith('문제 공통지문 범위:'));
  record.notes.push(note);
}

const bodyA=records.filter(r=>r.source_role==='question');
function normalize(s) { return s.normalize('NFKC').replace(/[^가-힣A-Za-z0-9]/g,'').toLowerCase(); }
function contentOrigin(text, year=null) {
  // Require several long exact anchors and a unique origin. Similarity alone
  // does not establish an exam year for a locally renumbered textbook question.
  const normalized=normalize(text); const candidates=[];
  for(const record of bodyA) {
    if(year && record.origin.year!==year)continue;
    const hay=normalize(record.text);let hits=0;
    for(let i=0;i+40<=normalized.length;i+=35) if(hay.includes(normalized.slice(i,i+40)))hits++;
    if(hits>=2)candidates.push({record,hits});
  }
  candidates.sort((x,y)=>y.hits-x.hits);
  const best=candidates[0];if(!best)return null;
  if(candidates.some(c=>c!==best && c.hits>=Math.max(2,best.hits*.7) && originKey(c.record.origin)!==originKey(best.record.origin)))return null;
  return best.record;
}
const imperativePattern=/서술하시오|기재하시오|기술하시오|설명하시오|계산하시오|제시하시오|작성하시오|답하시오|구하시오|고르시오|지적하시오|적으시오|판단하시오|열거하시오|쓰시오/;
const genericDemand=text=>/^(?:다음|아래)(?:의)?(?:내용|사례|자료)?(?:을|를)?읽고(?:아래의)?(?:각)?(?:물음|요구사항)에답하시오[.!]?$/.test(text.replace(/\s/g,''));
function directElements(text) {
  const cleanText=clean(text.replace(/^\s*\[\s*문\s*제[^\n]*\n/,'').replace(/\[요구사항\]/g,'').replace(/^\s*[（(\[]?물\s*음\s*\d+\s*[）)\]]?/,''));
  // Source requirements can be long. Never chop a condition off to meet a label
  // length limit; leave complex table/context extraction for explicit review.
  const sentences=cleanText.split(/(?<=[.!?])\s+/).filter(s=>imperativePattern.test(s));
  return sentences.filter(s=>s.length>=18 && s.length<=700 && !genericDemand(s))
    .map(label=>({label,topic_id:topicOf(label),kind:kindOf(label)}));
}
function extractB() {
  const yearPages=[11,27,43,59,75,91,107,123,137,153,167];
  for(let yi=0;yi<10;yi++) {
    const year=2025-yi,start=b.pages.get(yearPages[yi]).start,end=b.pages.get(yearPages[yi+1]).start-1;
    const boundaries=[];let problem=null;let seen=new Set();
    for(let n=start;n<=end;n++) {
      const line=b.lines[n-1];const pm=line.match(/^\s*[\[(]?\s*문\s*제\s*(\d+)\s*[\])]?/);
      if(pm){problem=pm[1];seen=new Set();boundaries.push({type:'problem',start:n,problem});continue;}
      const m=subMarker(line);
      if(m){if(seen.has(m[1]))problem=null;seen.add(m[1]);boundaries.push({type:'sub',start:n,problem,sub:m[1],item:m[2] || null});}
    }
    for(let i=0;i<boundaries.length;i++) {
      const entry=boundaries[i];if(entry.type!=='sub')continue;
      const stop=boundaries[i+1]?.start || end+1;
      const range=span(b,entry.start,trimEnd(b,entry.start,stop-1));
      const indexed=entry.problem ? indexes.filter(r=>r.origin.year===year && r.origin.problem===entry.problem && r.origin.subquestion===entry.sub) : [];
      const content=contentOrigin(range.text,year);
      // A structural ID and source-content match must agree if both exist.
      const conflict=content && indexed.length && (content.origin.problem!==entry.problem || content.origin.subquestion!==entry.sub);
      const chosen=!conflict && indexed.length===1 ? indexed[0] : !conflict ? content : null;
      const id=chosen ? structuredClone(chosen.origin) : {kind:'cpa_exam',year,problem:null,subquestion:null,item:null};
      const problemBoundary=boundaries.slice(0,i).findLast(entry=>entry.type==='problem');
      const contextEnd=problemBoundary ? boundaries.find(entry=>entry.type==='sub'&&entry.start>problemBoundary.start)?.start : null;
      add(b,range.source.start_line,range.source.end_line,'question',id,chosen ? elementsFor(chosen) : directElements(range.text),
        chosen && imperativePattern.test(range.text) ? 'extracted' : 'needs_review',[
          'B의 문제부(원문 11–166쪽)에서 물음/다음 문제 경계로 추출. 뒤의 정답·해설부는 빈도에 추가하지 않음.',
          ...(problemBoundary && contextEnd?[`문제 공통지문 범위: ${b.file}:${problemBoundary.start}-${contextEnd-1}. 번호 흐름이 미확정이면 이 문맥도 재검토해야 함.`]:[]),
          ...(chosen?[`연도·문제·물음 구조를 A의 저자표/실제 발문 ${chosen.id}에 연결. 교재간 재수록은 같은 출제 1회.`]:['원시험 세부 번호 또는 요구문 경계의 교차검증 미확정. 빈도 계산에서 확정 기출로 취급하지 말 것.']),
          ...(conflict?['본문 일치 후보와 인쇄된 번호 흐름이 충돌하여 원시험 번호를 확정하지 않음.']:[]),
          '2단 편집의 추출 순서 때문에 답안양식·공통지문·다음 항목이 섞일 수 있음. 세부 항목 의미분해 검토 필요.',
        ]);
    }
    const expected=indexes.filter(r=>r.origin.year===year);
    for(const row of expected)if(!records.some(r=>r.source.file===b.file&&originKey(r.origin)===originKey(row.origin)))issue(b,start,end,`${year} 문제 ${row.origin.problem} 물음 ${row.origin.subquestion}${row.origin.item?'-'+row.origin.item:''}: B의 독립 발문 연결 미확정. A ${row.id}는 보존.`);
  }
}
extractB();

function topicalQuestionStart(line) {return /^\s*\[\s*문\s*제\s*[^\]]{0,10}\]/.test(line);}
function extractTopical() {
  const start=topical.pages.get(18).start,end=topical.pages.get(354).start-1;
  const starts=[];
  for(let n=start;n<=end;n++)if(topicalQuestionStart(topical.lines[n-1]))starts.push(n);
  for(let i=0;i<starts.length;i++) {
    const from=starts[i],limit=(starts[i+1] || end+1)-1;
    const reviewed={
      3101:{end:3105,key:'2022:1:2:',elementIndexes:[3],item:'4'},
      4886:{end:4900,key:'2021:8:2:',elementIndexes:[0,1],item:null},
      6935:{end:6941,key:'2025:3:3:',elementIndexes:[3],item:'4'},
      7503:{end:7518,key:'2021:8:4:',elementIndexes:[0],item:'1'},
      12401:{end:12417,key:'2025:9:2:',elementIndexes:[0],item:null},
    }[from];
    if(reviewed) {
      if(sha(topical.bytes)!=='764966468524dccf81522fa6f8e2f3b5b642d74234ee2fb0dc48b0d71791ba2a')throw new Error('Topical edition changed: recheck reviewed question boundaries.');
      const primary=bodyA.find(r=>originKey(r.origin)===reviewed.key);
      add(topical,from,reviewed.end,'question',{...structuredClone(primary.origin),item:reviewed.item},reviewed.elementIndexes.map(i=>structuredClone(primary.elements[i])),'extracted',[
        `A의 ${primary.id}와 사례·요구문을 직접 대조한 부분재수록. 해당 요구만 연결함.`,
        '요구문 다음에 놓인 사례 조건·보기까지 포함하고 해설은 제외함. 같은 원시험의 추가 빈도로 세지 않음.',
      ]);
      continue;
    }
    // Main topical material interleaves answers without stable answer markers.
    // Only preserve through the first complete demand, never its following answer.
    let stop=null;
    for(let n=from+1;n<=limit;n++) {
      const line=topical.lines[n-1];
      if(imperativePattern.test(line) && !genericDemand(line)) {stop=n;break;}
      if(answerCue(line))break;
    }
    if(!stop){issue(topical,from,limit,'주제별 문제 블록의 실제 발문 종료/답안 시작을 자동 확정하지 못함. 원시험/요구사항 수동 대조 필요.');continue;}
    const value=span(topical,from,stop),match=contentOrigin(value.text);
    const localNumber=topical.lines[from-1].match(/문\s*제\s*(\d+)/)?.[1] || null;
    add(topical,from,stop,'question',match ? structuredClone(match.origin) : {kind:'unknown',year:null,problem:null,subquestion:null,item:null},
      directElements(value.text),'needs_review',[
        `교재 절별 로컬 문제번호: ${localNumber || 'OCR 미확정'}. 이 번호를 원시험 문제번호로 사용하지 않음.`,
        ...(match?[`두 개 이상의 40자 연속 원문 일치로 A의 ${match.id}에 연결. 연도간 동형 문항이 경합하면 연결하지 않음.`]:['원시험 연도/문제번호가 판독되지 않거나 유일한 원문 결속이 없음. 재수록 후보만 보존하고 빈도 확정 제외.']),
        '첫 명시적 요구문까지의 후보 인용이다. 뒤에 제시된 조건·보기·추가 요구가 남을 수 있으므로 완전한 발문으로 승인하지 않음.',
        '원시험 ID의 연결은 재수록 식별이며 원시험의 모든 세부요구가 이 부분재수록에 존재한다는 뜻이 아님. 해당 인용의 요구만 임시 라벨화함.',
      ]);
    // Do not quietly claim the rest of a multi-demand block has been covered.
    for(let n=stop+1;n<=limit;n++)if(imperativePattern.test(topical.lines[n-1])) {
      issue(topical,n,n,'동일 주제별 블록에서 추가 명령문 발견. 별도 요구사항인지 답안의 인용인지 미확정하여 자동 집계 제외.');
    }
  }
  // Latest complete papers are retained too; already extracted topical versions
  // must not be counted as another sitting of the exam.
  const latest=[{year:2025,from:354,to:369},{year:2024,from:370,to:382},{year:2023,from:383,to:394}];
  for(const range of latest) {
    const begin=topical.pages.get(range.from).start,finish=topical.pages.get(range.to+1).start-1;
    let problem=null;const markers=[];
    for(let n=begin;n<=finish;n++) {
      const line=topical.lines[n-1];const pm=line.match(/^\s*[\[(]?\s*문\s*제\s*(\d+)\s*[\])]?/);
      if(pm){problem=pm[1];markers.push({start:n,type:'problem',problem});continue;}
      const sm=subMarker(line);if(sm)markers.push({start:n,type:'sub',problem,sub:sm[1]});
    }
    for(let i=0;i<markers.length;i++) {
      const marker=markers[i];if(marker.type!=='sub')continue;
      // The printed "문제 08" is disconnected by two-column OCR. This short
      // prompt has fewer anchors than the automatic origin matcher requires.
      if(marker.start===14779) {
        if(sha(topical.bytes)!=='764966468524dccf81522fa6f8e2f3b5b642d74234ee2fb0dc48b0d71791ba2a')throw new Error('Topical edition changed: recheck reviewed question boundaries.');
        const primary=bodyA.find(r=>originKey(r.origin)==='2024:8:1:');
        add(topical,14779,14782,'question',structuredClone(primary.origin),structuredClone(primary.elements),'extracted',[
          `A의 ${primary.id} 및 B 원문 39쪽과 실제 발문·문제 08의 상황 1을 직접 대조함. 기업 생산 정보의 신뢰성 평가 절차 두 가지 요구만 연결함.`,
          `문제 공통지문 범위: ${topical.file}:14754-14776. 다음 두 줄은 이전 문제의 OCR 교차 발문이므로 이 공통지문에 포함하지 않음.`,
          '같은 원시험의 재수록으로 추가 빈도를 부여하지 않음.',
        ]);
        continue;
      }
      const stop=trimEnd(topical,marker.start,(markers[i+1]?.start || finish+1)-1);
      const value=span(topical,marker.start,stop);
      const indexed=indexes.find(r=>r.origin.year===range.year&&r.origin.problem===marker.problem&&r.origin.subquestion===marker.sub);
      const match=indexed || contentOrigin(value.text,range.year);
      add(topical,marker.start,stop,'question',match ? structuredClone(match.origin) : {kind:'cpa_exam',year:range.year,problem:null,subquestion:null,item:null},
        match?elementsFor(match):directElements(value.text),match && imperativePattern.test(value.text)?'extracted':'needs_review',[
          '주제별 교재 후반의 전체 기출 재수록. 같은 연도·문제·물음은 다른 교재와 주제별 본문을 합쳐 출제 1회로 계산.',
          ...(match?[`A의 원시험 ${match.id}와 연결.`]:['원시험 세부 번호 결속 미확정.']),
          '2단 편집 OCR 순서와 세부항목 경계를 검토해야 함. 해설 자체를 요구사항으로 추출하지 않음.',
        ]);
    }
  }
}
extractTopical();

function writeOutput() {
  const primary=records.filter(record=>record.source.file===a.file&&record.source_role==='question');
  const primaryKeys=new Set(primary.map(record=>originKey(record.origin)));
  for(const key of curatedKeys)if(!primaryKeys.has(key))throw new Error(`Reviewed actual requirement has no source question: ${key}`);
  for(const record of primary)if(!curatedKeys.has(originKey(record.origin)))throw new Error(`Actual A requirement not semantically extracted: ${originKey(record.origin)}`);
  const output = { version:1, sources:documents.map(doc => ({ file:doc.file, sha256:sha(doc.bytes), pages:doc.pages.size,
    coverage_note: doc === a
      ? `2014–2025년 저자 관련 주제 표 12개·398행과 실제 발문 ${primary.length}행 전수 대조. 저자표에 없는 2014 문제5 물음3·2016 문제7 물음2–5 포함. 2015 문제7 물음3의 두 item은 한 물음이다. 모든 실제 본문의 조건·행위를 curated 모듈로 의미분해하였지만 교재의 정답·기준 적용을 승인한 것은 아니다. 역사적 계산·법규·IT 요구를 보존한다.`
      : doc === b ? '원문 11–166쪽 연도별 문제부에서 335개 물음 후보를 추출하고 A 원시험과 대조함. 번호·발문 경계 충돌은 needs_review/unresolved로 남겼다. 해설부는 추가 출제가 아니며 같은 원시험 A 본문을 빈도 기준으로 사용한다.'
        : '주제별 본문과 2023–2025 전체 기출 재수록의 물음 후보를 추출함. 주제별 발문 뒤 조건·보기·추가 요구의 경계가 불확실한 후보는 needs_review로 남겨 확정 빈도에서 제외한다. 직접 대조한 일부 부분재수록만 해당 세부요구를 연결하고 A 전체 요소를 자동 복제하지 않는다. 미확정 위치는 unresolved 참조.' })), records, unresolved };
  fs.mkdirSync(here,{recursive:true});
  fs.writeFileSync(path.join(here,'past-exam.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({records:records.length,index:records.filter(r=>r.source_role==='author_index').length,question:records.filter(r=>r.source_role==='question').length,unresolved:unresolved.length}));
}
writeOutput();
