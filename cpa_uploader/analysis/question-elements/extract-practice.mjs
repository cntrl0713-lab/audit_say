import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { advancedCuration, thematicCuration, excludedDemandLines, demandContinuationEnds, thematicContexts } from './practice-curated.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, '../../..');
const base = 'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/';
const files = ['고급_회계감사_연습.md', '주제별_회계감사_연습.md'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const compact = value => value.replace(/\s+/gu, ' ').trim();
const legacyDemand = /(?:서술|기재|설명|기술|작성|제시|열거|판단|계산|산출|선택|지적|평가|답|구분|비교|수정|결정|구하|쓰|고르|찾으|적으|답하|보이)[가-힣\s]{0,7}(?:시오|시요|시으|시스|하라)|(?:무엇|어떠|얼마|어떤)[^?\n]{0,110}\?/u;
const demand = /(?:서술|기재|설명|기술|작성|제시|열거|판단|계산|산출|선택|지적|평가|답|구분|비교|수정|결정|구하|쓰|고르|찾으|적으|답하|보이)[가-힣\s]{0,7}(?:시오|시요|시으|시스|하라)(?:(?![가-힣])|(?=단[,.( ]))|(?:무엇|어떠|얼마|어떤)[^?\n]{0,110}\?/u;
const confirmedDemand = demand;
const explicitSubquestion = /^\s*[([]?\s*물음\s*(\d{1,2})\s*[)\]]?\s*/u;
const questionHeader = /^\s*(?:[.\[<느]*\s*)문제\s*(\d{1,2})\s*(?:[\].>으:]|$|\s)/u;
const answerMarker = /^(?:[가-힣Iㅣ<>\[\]: ]{0,4})?(?:모범[답담립][안인만]|정답\s*(?:및\s*해설)?|해설|아답안|답안\s*$|I졑|졑별|가능한 다른 답변|추가(?:설명|가능답안)|.*배점\s*\d)/u;
const pageNoise = /^(?:## |\s*$|\d{1,3}\s*$|20\d{2}\s*(?:고급|회계감사)|Chapter\s*\d|제\d+장.*\||\d+[/-]\d+\s*(?:회계감사|$)|.*\|\s*동차회계감사연습)/u;
const instruction = /답안\s*작성시\s*유의사항|답안양식을?\s*(?:제시|준수)|문제에서 서술하라고|모든 문제는.*(?:회계|기준)|조건을?\s*초과한\s*부분|답의 분량/u;

// These are topic assignments, not occurrence counts or authoritative standards conclusions.
// More specific subjects precede broad words such as 감사보고서 and 감사절차.
const subjects = [
  ['18', /소규모기업|소규모\s*기[업압]/u, '소규모기업 감사'],
  ['17', /내부회계관리|내부회[계게]관리/u, '내부회계관리제도'],
  ['14', /그룹감사|그룹재무|부문감사|부문중요성|연결절차|연결재무제표/u, '그룹감사'],
  ['19', /중간재무|분[·ㆍ.]?반기|검토업무|인증업무|합의된\s*절차|확신업무|검토보고/u, '검토·인증·관련서비스'],
  ['13', /서비스조직|서비스감사|아웃소싱|내부감사[인기능]|전문가[의가를]|전문가 활용|전문가가 수행/u, '타인의 업무 활용'],
  ['16', /핵심감사사항|강조사항|기타사항|기타정보|비교재무|전기대응/u, '감사보고 특수사항'],
  ['12', /후속사건|서면진술|계속기업|미수정왜곡|왜곡표시.*(?:집계|수정.*요청|평가)|감사보고서일\s*(?:후|이후)|재무제표\s*발행일/u, '감사종결·후속사건·계속기업'],
  ['11', /회계추정|특수관계|경영진.*편의|점추정|추정불확실/u, '회계추정·특수관계자'],
  ['10', /표본|샘플|분석적\s*절차|금액가중|부당수용|부당거부|신뢰계수|허용오류|추정오류/u, '분석적절차·표본감사'],
  ['09', /외부조회|소극적\s*조회|적극적\s*조회|미회신|재고(?:자산)?\s*(?:실사|입회)|실사입회|소송.*배상|기초잔액|전임감사/u, '조회·재고실사·소송·기초잔액'],
  ['01', /독립성|윤리|안전장치|품질관리|품질경영|감사품질|표준\s*감사시간|손해배상|법적\s*책임|비밀유지|공인회계사법|감리|등록.*회계법인/u, '윤리·독립성·감사품질'],
  ['03', /감사계약|감사인\s*선임|선임기한|감사인\s*지정|수임|업무\s*(?:수용|수락|조건|변경)|전제조건/u, '감사계약·선임·수임'],
  ['04', /중요성|감사문서|감사조서|전반감사전략|감사계획|벤치마크|감사파일/u, '계획·문서화·중요성'],
  ['05', /부정|법규.*(?:위반|준수)|지배기구.*커뮤니케이션|통제미비|통제.*미비점|외부감사법.*(?:보고|통보)/u, '부정·법규·커뮤니케이션'],
  ['06', /위험평가|고유위험|통제위험|중요왜곡표시위험|내부통제|통제환경|통제활동|정보시스템|데이터베이스|데이터\s*분석|데이터처리|SQL|JOIN|쿼리|질의어|정규화|정보기술|IT통제|IT 일반/u, '위험평가·내부통제·정보기술'],
  ['07', /통제테스트|통제의\s*운영효과성|실증절차|추가감사절차|전반적인?\s*대응|세부테스트/u, '위험대응·통제테스트·실증절차'],
  ['08', /감사증거|경영진주장|문서검사|재계산|재수행|감사기술|관찰|증거.*신뢰성/u, '감사증거·경영진주장'],
  ['15', /감사의견|감사보고서|적정의견|한정의견|부적정의견|의견거절/u, '감사의견·감사보고서'],
  ['02', /전문가적\s*의구심|합리적\s*확신|고유한계|감사위험|감사의\s*(?:목적|한계|분류)|회계감사.*(?:수요|역할)|재무제표.*신뢰성/u, '회계감사의 기본개념'],
];

function subject(text, context) {
  // A direct subject in the requested clause takes priority over its chapter heading.
  return subjects.find(([, pattern]) => pattern.test(text))
    ?? subjects.find(([, pattern]) => pattern.test(context)) ?? [null, null, ''];
}

function nearestHeading(lines, from, lower) {
  for (let i = from; i >= Math.max(lower, from - 90); i--) {
    const line = compact(lines[i]);
    if (!line || pageNoise.test(line) || demand.test(line) || line.length > 100) continue;
    if (/^\d{1,2}(?:[.．]\d{1,2})+[.．]?\s+[가-힣]|^(?:section|Section)\s*\d|^•.*(?:ISA|기준|감사)|GS\s*모의고사\s*문제/u.test(line)) {
      return line.replace(/^\s*(?:\d[\d.．]*|section\s*\d+|Section\s*\d+|•)\s*/u, '');
    }
  }
  return '';
}

function boundaries(text) {
  const lines = text.split(/\r?\n/u);
  const pages = [];
  for (const [index, line] of lines.entries()) {
    const matched = line.match(/^## 원문 페이지 (\d+)/u);
    if (matched?.[1]) pages.push({ page: Number(matched[1]), start: index });
  }
  pages.forEach((entry, i) => { entry.end = pages[i + 1]?.start ?? lines.length; });
  return { lines, pages };
}

function originAt(lines, index, advanced) {
  const origin = { kind: advanced ? 'practice' : 'unknown', year: null, problem: null, subquestion: null, item: null };
  const notes = [];
  const recent = lines.slice(Math.max(0, index - 1200), index + 1);
  let headerIndex = -1;
  for (let i = recent.length - 1; i >= 0; i--) {
    const gs = recent[i].match(/(\d{2,4})\s*년\s*제\s*(\d)\s*회\s*GS\s*모의고사\s*문제\s*(\d{1,2})/u);
    if (gs) {
      origin.kind = 'mock'; origin.year = Number(gs[1]) < 100 ? 2000 + Number(gs[1]) : Number(gs[1]);
      origin.problem = `GS${gs[2]}-${gs[3]}`; headerIndex = i;
      notes.push(`교재 출처 표시: ${compact(recent[i])}`); break;
    }
    if (questionHeader.test(recent[i]) || /^\s*[(\[]\s*문제\s*/u.test(recent[i])) {
      headerIndex = i;
      const adjacent = recent.slice(Math.max(0,i-2),i+1).join(' ');
      const source = adjacent.match(/(\d{2,4})\s*년\s*제\s*(\d)\s*회\s*GS\s*모의고사\s*문제\s*(\d{1,2})/u);
      if(source){origin.kind='mock';origin.year=Number(source[1])<100?2000+Number(source[1]):Number(source[1]);origin.problem=`GS${source[2]}-${source[3]}`;notes.push(`교재 인접 출처 표시: ${compact(adjacent)}`);}
      break;
    }
  }
  const suffix = recent.slice(headerIndex < 0 ? 0 : headerIndex);
  for (let i = suffix.length - 1; i >= 0; i--) {
    const sub = suffix[i].match(explicitSubquestion);
    if (sub) { origin.subquestion = sub[1]; break; }
  }
  if (advanced && origin.kind !== 'mock') {
    const pageLine = lines.slice(0, index + 1).filter(line => /^## 원문 페이지 /u.test(line)).at(-1);
    const page = Number(pageLine?.match(/\d+/u)?.[0]);
    if (page >= 284 && page < 384) {
      // Printed round/year headings are explicit in the source; dates in legal instructions are ignored.
      const covers = [[284, 2023, 1], [298, 2023, 2], [313, 2023, 3], [327, 2024, 1], [341, 2024, 2], [357, 2025, 1], [371, 2025, 2]];
      const cover = covers.filter(([start]) => page >= start).at(-1);
      origin.kind = 'mock'; origin.year = cover[1];
      let problem = null;
      for (let i = index; i >= 0; i--) {
        if (/^## 원문 페이지 /u.test(lines[i]) && Number(lines[i].match(/\d+/u)[0]) < cover[0]) break;
        const q = lines[i].match(/^\s*\[문제\s*(\d{1,2})\]/u);
        if (q) { problem = q[1]; break; }
        if (/^\s*[(\[]\s*문제\s*/u.test(lines[i])) break;
      }
      origin.problem = problem ? `GS${cover[2]}-${problem}` : null;
      notes.push(`PART 2: ${cover[1]}년 제${cover[2]}회 GS 모의고사; 교재 원문 ${cover[0]}쪽부터 시작`);
    }
  }
  return { origin, notes };
}

function cleanRequest(value) {
  return compact(value).replace(/^\s*[([]?\s*물음\s*\d{1,2}\s*[)\]]?\s*/u, '')
    .replace(/^\s*(?:물음|단순암기|암기응용|OX판단)\s*/u, '')
    .replace(/\s*(?:\[답안양식\]|\[단안양식\]).*$/u, '').trim();
}

function actionKinds(text) {
  const values = [];
  if (/정의(?:하|를|와|하고)|의미(?:를|가|와)|뜻(?:을|이)/u.test(text)) values.push('definition');
  if (/판단(?:하|과|을|하고)|적절한지|적절하지|옳은지|가능한지|여부(?:를|와|및|에\s*대한|\s*(?:제시|기재))|어떤\s*의견/u.test(text)) values.push('judgment');
  if (/이유|근거(?:를|와|도|는|만|의)|판단\s*근거|취지|필요성|원인/u.test(text)) values.push('reason');
  if (/(?:절차|조치|대응|권고)(?:를|와|는|가|\s*중|\s*두|\s*세)|(?:절차|조치).*수행해야|수행해야.*(?:절차|조치)|수행할.*(?:절차|조치)/u.test(text)
    && !/절차.*(?:이유|근거|명칭|목적).*시오/u.test(text)) values.push('procedure');
  if (/비교(?:하|와|를)|차이(?:점|를|는|와)|공통점|장점.*단점|장[·ㆍ]단점/u.test(text)) values.push('comparison');
  if (/계산(?:하|과|을|한|해)|산출(?:하|한|할)|금액.*구하|분개(?:하|를)/u.test(text)) values.push('calculation');
  // "세 가지 절차" is one procedure demand; quantity does not create another element.
  if (!values.length && /(?:두|세|네|다섯|여섯|\d)\s*가지|열거|나열|종류|구성요소|요건|요소|상황.*서술/u.test(text)) values.push('list');
  return values.length ? values : ['other'];
}

const actionLabels = { definition: '정의', judgment: '판단', reason: '이유·근거', procedure: '절차·조치', list: '요구 항목', comparison: '비교', calculation: '계산', other: '요구사항' };
const concreteSubjects = [
  /표준\s*감사시간/u, /비밀유지(?:강령)?/u, /이해상충/u, /독립성/u, /윤리강령/u,
  /소극적\s*조회/u, /적극적\s*조회/u, /외부조회/u, /재고(?:자산)?\s*실사입회/u, /재고실사/u, /기초잔액/u,
  /전문가적\s*의구심/u, /합리적\s*확신/u, /고유한계/u, /전반감사전략/u, /벤치마크/u, /수행중요성/u, /중요성/u,
  /감사문서/u, /감사조서/u, /최종감사파일/u, /서비스조직/u, /서비스감사인/u, /내부감사기능/u, /전문가의?\s*업무/u,
  /회계추정치?/u, /특수관계자/u, /계속기업/u, /후속사건/u, /서면진술/u, /미수정왜곡표시/u,
  /내부회계관리제도/u, /통제미비점/u, /통제테스트/u, /위험평가절차/u, /통제환경/u, /통제활동/u,
  /실증적인?\s*분석적\s*절차/u, /분석적\s*절차/u, /금액가중확률\s*표본감사/u, /표본감사/u, /표본규모/u,
  /핵심감사사항/u, /강조사항문단/u, /기타사항문단/u, /기타정보/u, /감사의견/u, /감사보고서/u,
  /그룹감사/u, /부문감사인/u, /중간재무제표\s*검토/u, /소규모기업/u,
  /부정위험/u, /부정/u, /경영진주장/u, /감사증거/u, /감사계약/u,
];
function conciseSubject(clause, heading) {
  const direct = concreteSubjects.map(pattern => clause.match(pattern)?.[0]).find(Boolean);
  if (direct) return compact(direct);
  const title = compact(heading).replace(/\s*\((?:ISA|기준서)[^)]*\)/gu, '').replace(/.*문제\s*\d+\s*[으.]?\s*/u, '').replace(/\s*-\s*\d{2}년.*$/u, '');
  if (title.length > 2 && title.length < 90 && !/[罸졑�]|\d{4}|^기\d|:$|[,，]/u.test(title)) return title;
  return subject(clause, heading)[2] || '원문 물음';
}

function requirementLabel(clause, heading, kind) {
  const target = conciseSubject(clause, heading);
  if (kind === 'judgment') {
    if (/수임|업무\s*수[용락]/u.test(clause)) return `${target}: 주어진 상황의 업무 수임 가능 여부 판단`;
    if (/감사의견|어떤\s*의견/u.test(clause)) return `${target}: 주어진 사실에 따른 감사의견 결정`;
    return `${target}: 제시된 설명·수행 내용의 적절성 판단`;
  }
  if (kind === 'reason') {
    if (/취지/u.test(clause)) return `${target}: 제도 도입 취지 설명`;
    if (/필요성/u.test(clause)) return `${target}: 필요성 설명`;
    if (/원인/u.test(clause)) return `${target}: 원인 설명`;
    return `${target}: 요구한 판단·조치의 이유 또는 근거 설명`;
  }
  if (kind === 'definition') return `${target}: 정의·의미 설명`;
  if (kind === 'comparison') return `${target}: 요구한 대상의 차이점·공통점 비교`;
  if (kind === 'calculation') {
    const calculated = clause.match(/([^.,:]{2,80})(?:을|를)\s*(?:계산|산출|구하)/u)?.[1]?.trim();
    return `${target}: ${calculated ? calculated.replace(/^.*(?:이용하여|바탕으로|대해)\s*/u, '') : '요구한 금액·수량'} 계산`;
  }
  if (kind === 'procedure') {
    const condition = clause.match(/(?:경우|때|상황)(?:에|에서|에는|라면)?\s*([^.]*)/u)?.[0];
    if (/권고/u.test(clause)) return `${target}: 발견된 문제점에 대한 개선 권고사항 제시`;
    if (/대체/u.test(clause)) return `${target}: 명시된 상황의 대체적 감사절차 제시`;
    return `${target}: ${condition ? '명시된 조건에서 ' : ''}요구한 감사절차·조치 제시`;
  }
  if (kind === 'list') {
    const description = /고려.*사항/u.test(clause) ? '고려사항' : /요건|조건/u.test(clause) ? '적용 요건·조건' : /상황|경우/u.test(clause) ? '적용 상황' : /구성/u.test(clause) ? '구성요소' : /명칭|종류/u.test(clause) ? '명칭·종류' : '요구 항목';
    return `${target}: ${description} 제시`;
  }
  return `${target}: ${clause.replace(/(?:서술|기재|설명|제시|작성)하시오[.]?/gu, '제시').replace(/\s*[(（]단[\s\S]*$/u, '').trim()}`;
}
function requestedObject(clause) {
  return clause.replace(/^\s*\([1-9]\)\s*/u, '')
    .replace(/(?:각각\s*)?\d+\s*줄\s*이내로\s*/gu, '')
    .replace(/(?:두|세|네|다섯|여섯|\d+)\s*가[지자]만?\s*/gu, '')
    .replace(/(?:간략히|구체적으로)\s*/gu, '')
    .replace(/(?:서술|기재|설명|기술|작성|제시|열거|판단|계산|산출|선택|지적|평가|구분|비교|수정|결정)하(?:시오|시요|시으|시스)[.]?/gu, '')
    .replace(/(?:쓰시오|구하시오|고르시오)[.]?/gu, '')
    .replace(/(?:을|를)\s*$/u, '').trim();
}
function extractElements(request, heading) {
  const full = cleanRequest(request);
  // Case facts are preserved in source/context; action typing uses only the demand sentence.
  const clean = full.split(/<요구사항(?:\s*\d+)?\s*>/u).at(-1).split(/(?<=[다요])[.。]\s+/u).at(-1).trim();
  const [topicId, , fallback] = subject(clean, heading);
  const isGeneric = /각\s*(?:항목|상황)|다음.*(?:설명|진술)|위\s*(?:상황|사례|자료|내용)|밑줄|빈칸|빈간|위\s*[\[<]|위의?\s*사례/u.test(clean);
  const contextual = isGeneric && heading ? `${heading}: ${clean}` : clean;
  // Preserve the requested conditions verbatim; do not manufacture an answer from commentary.
  const clauses = contextual.split(/(?=\([1-9]\)\s*(?:그|감사|경영|회사|추가|재무|어떤|이유|근거|수행|필요|위험|왜곡|명칭|책임|법규|외부|적절|내부|정의|계산|결론|효과))/u).filter(value => compact(value));
  const elements = [];
  for (const raw of clauses) {
    const clause = compact(raw);
    // Avoid separate elements containing only the preamble before (1)/(2).
    if (clauses.length > 1 && !demand.test(clause) && !/[)]|서술|기재|이유|근거|판단|절차|효과|책임|명칭|정의/u.test(clause)) continue;
    const [localTopic] = subject(clause, `${heading} ${fallback}`);
    const kinds = actionKinds(clause);
    for (const kind of kinds) {
      const noun = requestedObject(clause);
      // For a single action, preserve its concrete object/conditions as a noun phrase.
      // Multi-action prompts use separate target/action labels rather than repeated full prompts.
      const oneAction = kinds.length === 1 && noun.length > 5 && noun.length < 170 && !isGeneric && !/[。.]\s/u.test(noun);
      elements.push({ label: oneAction ? `${conciseSubject(clause, heading)}: ${noun} — ${actionLabels[kind]}` : requirementLabel(clause, heading, kind), topic_id: localTopic ?? topicId, kind });
    }
    if (/위협/u.test(clause) && /해당되는.*위협|위협.*(?:종류|명칭|함께|기재)|위협을.*(?:제시|서술)/u.test(clause)) {
      elements.push({ label: `${conciseSubject(clause, heading)}: 상황별 윤리강령·독립성 훼손 위협 식별`, topic_id: '01', kind: 'list' });
    }
    if (/안전장치/u.test(clause) && /안전장치.*(?:서술|제시|기재|없음|쓸 것)|안전장치를.*감소/u.test(clause)) {
      elements.push({ label: `${conciseSubject(clause, heading)}: 수용 가능한 수준으로 위협을 낮추는 안전장치 제시`, topic_id: '01', kind: 'procedure' });
    }
    if (/재무제표\s*효과|재무제표.*미치는\s*영향/u.test(clause) && /서술|제시|기재|각각/u.test(clause)) {
      elements.push({ label: `${conciseSubject(clause, heading)}: 관련 계정·손익·재무상태표 영향 설명`, topic_id: localTopic ?? topicId, kind: 'other' });
    }
  }
  const unique = [...new Map(elements.map(element => [JSON.stringify(element), element])).values()];
  return { elements: unique.length ? unique : [{ label: contextual, topic_id: topicId, kind: 'other' }], isGeneric };
}

function contextAt(lines, start, end, page, file, advanced) {
  let from = page.start + 1;
  // Context begins at the visible problem heading when available, not at an answer paragraph.
  if (advanced) for (let i = start; i >= Math.max(0, start - 500); i--) {
    if (/문제\s*\d{1,2}.*GS\s*모의고사|^\s*[(\[]\s*문제\s*/u.test(lines[i])) { from = i; break; }
    if (/^## 원문 페이지 /u.test(lines[i]) && i < page.start - 100) break;
  }
  let to = end;
  for (let i = end + 1; i < Math.min(lines.length, end + 180); i++) {
    if (answerMarker.test(lines[i]) || explicitSubquestion.test(lines[i]) || questionHeader.test(lines[i]) || demand.test(lines[i])) break;
    // A following page can hold scenario continuation; at most two physical pages are included.
    if (/^## 원문 페이지 /u.test(lines[i]) && Number(lines[i].match(/\d+/u)[0]) > page.page + 1) break;
    to = i;
  }
  const contextPage = Number(lines.slice(0, from + 1).filter(line => /^## 원문 페이지 /u.test(line)).at(-1)?.match(/\d+/u)[0] ?? page.page);
  return { file, start_line: from + 1, end_line: Math.max(end, to) + 1, page: contextPage };
}

function excludedArea(advanced, page) {
  if (advanced && page < 10 || !advanced && page < 16) return '표지·판권·서문·전체 목차';
  if (advanced && page >= 384) return 'PART 2 정답·해설: 실제 물음 occurrence로 세지 않음';
  if (advanced && page === 283) return 'PART 2 회차별 목차';
  return null;
}

function extractFile(file, bytes) {
  const text = bytes.toString('utf8');
  const { lines, pages } = boundaries(text);
  const advanced = file.includes('고급_');
  const records = [], unresolved = [];
  const stats = { pages: pages.length, excluded_pages: 0, pages_with_requests: 0, pages_without_requests: 0, candidate_demands: 0 };
  const accounted = new Set();
  let lastEnd = -1;
  for (const page of pages) {
    // The later thematic pages have an independently reviewed ID-based overlay.
    // Keep their raw boundary version stable; their false positives are explicit exclusions there.
    const demand = !advanced && page.page > 450 ? legacyDemand : confirmedDemand;
    const excluded = excludedArea(advanced, page.page);
    if (excluded) { stats.excluded_pages++; continue; }
    const found = [];
    for (let index = page.start + 1; index < page.end; index++) {
      const splitEnding = (advanced || page.page <=450) && index > page.start+1 && !demand.test(lines[index-1]) && demand.test(`${lines[index-1]}\n${lines[index]}`);
      if (!demand.test(lines[index]) && !splitEnding) continue;
      stats.candidate_demands++;
      const local = lines.slice(Math.max(page.start + 1, index - 3), index + 1).join(' ');
      if (instruction.test(local) || /^\s*[•●*]/u.test(lines[index]) || /(?:시작|변경|목적|관련).*\([^)]*(?:ISA|기준서)/u.test(lines[index])
        || /(?:물음|물음들|다음 질문)에\s*답하시오[.]?\s*$/u.test(lines[index])) {
        accounted.add(index); continue;
      }
      let start = index;
      const standalone = explicitSubquestion.test(lines[index]) || /^\s*각\s*항목(?:의|별|에)/u.test(lines[index]);
      for (let before = index - 1; !standalone && before > Math.max(page.start, index - 14, lastEnd); before--) {
        const line = lines[before].trim();
        if (!line || answerMarker.test(line) || /^[•●㉦㉣㉨㉭①-⑳]|^(?:section|Section)(?:\s|$)|^\d+(?:\.\d+)+[.]?\s/u.test(line) || /^\d{1,3}\s*$/u.test(line)) break;
        if (pageNoise.test(line)) break;
        if (/[.。?]\s*(?:\([^)]*\))?\s*$/u.test(line) || demand.test(line)) break;
        start = before;
        if (explicitSubquestion.test(line) || /^<요구사항/u.test(line) || /^(?:물음|요구사항)$/u.test(line)) break;
      }
      // An explicit subquestion immediately before a one-line requirement is part of its provenance.
      if (start > page.start + 1 && explicitSubquestion.test(lines[start - 1])) start--;
      let end = index;
      for (let after = index + 1; after < Math.min(page.end, index + 4); after++) {
        const line = lines[after];
        if (!line.trim() || pageNoise.test(line) || answerMarker.test(line) || explicitSubquestion.test(line)) break;
        if (/[)）]\.?\s*$/u.test(lines[end]) && !/(?:설|안전|제|기재할|수행할)[)）]\s*$/u.test(lines[end])) break;
        if (!/하시오\([^)]*$/u.test(lines[end]) && !/^\s*(?:단[,:]|장치를|할 것|시오[.)])/u.test(line)) break;
        end = after;
        if (/[)）]\.?\s*$/u.test(line)) break;
      }
      if (start <= lastEnd) start = Math.max(index, lastEnd + 1);
      const quote = lines.slice(start, end + 1).join('\n');
      if (quote.length < 10 || /^\s*•/u.test(quote) || instruction.test(quote)) { accounted.add(index); continue; }
      const prefix = lines.slice(Math.max(page.start, start - 7), start).join(' ');
      const answerQuotation = /(?:추가설명|추가가능답안|예를 들어.*[“"']|문제에서는|문제에서.*요구)/u.test(prefix)
        && !explicitSubquestion.test(quote) && !/다음|각 항목|위 상황/u.test(quote);
      if (answerQuotation) {
        unresolved.push({ source: { file, start_line: start + 1, end_line: end + 1, page: page.page }, reason: '해설 안 발문 재인용 가능성: 출제 occurrence에서 제외하고 경계 확인 필요', text: quote });
        accounted.add(index); continue;
      }
      const heading = nearestHeading(lines, start - 1, Math.max(0, page.start - 80));
      const { origin, notes } = originAt(lines, index, advanced);
      const { elements, isGeneric } = extractElements(quote, heading);
      const review = [];
      if (isGeneric) review.push('지시어·항목형 발문: 앞뒤 사례/진술의 개별 조건 연결과 세부 항목 분해 확인 필요');
      if (!origin.problem || !origin.subquestion) review.push('원문 문제·물음 번호 일부 미확인: 없는 번호나 OCR 훼손 번호를 추정하지 않음');
      if (origin.kind === 'unknown') review.push('기출·GS·자체제작 구분과 원기출 연도 미확인: 서문의 교재 전체 설명을 개별 출처로 전용하지 않음');
      if (/[�]|(?:\^|罸|뾰|졑)|하(?:시으|시스)|^시오/u.test(quote)) review.push('발문에 OCR 훼손 또는 문장 경계 손상 가능성');
      if (elements.some(element => element.topic_id === null)) review.push('상위 주제를 명확히 특정할 수 없음');
      if (elements.some(element => element.kind === 'other' || /원문 물음|요구 항목|요구한 |제시된 설명|명시된 조건/u.test(element.label))) review.push('구체 대상·조건 또는 세부 요구사항의 의미 분해 확인 필요');
      if (/^[가-힣]{1,3}\s*(?:있다|한다|하고|할|한|시오)|\([^)]*$/u.test(quote) || /(?:설|안전|제)[)]\s*$/u.test(quote)) review.push('문장 앞뒤 연속성과 괄호 조건의 완전성 확인 필요');
      if (heading) notes.push(`근처 제목(분류 보조, 답안 아님): ${heading}`);
      notes.push('원문 연속 발문 인용. 사례·도표가 인용 밖에 있으면 원문 페이지와 전후 페이지를 함께 읽어야 함');
      notes.push(...review);
      const record = { id: `practice-${hash(`${file}\n${start + 1}\n${end + 1}\n${quote}`).slice(0, 20)}`,
        source: { file, start_line: start + 1, end_line: end + 1, page: page.page }, source_role: 'question', text: quote,
        context_source: contextAt(lines, start, end, page, file, advanced),
        local_question_id: `${advanced ? 'advanced' : 'thematic'}:p${page.page}:L${start + 1}`,
        origin, elements, status: review.length ? 'needs_review' : 'extracted', notes };
      records.push(record); found.push(record.id); accounted.add(index); lastEnd = end;
    }
    if (found.length) stats.pages_with_requests++;
    else {
      stats.pages_without_requests++;
      const visible = lines.slice(page.start + 1, page.end).filter(line => line.trim() && !pageNoise.test(line));
      const likelyAnswer = visible.some(line => answerMarker.test(line)) || visible.filter(line => /(?:기준서|ISA|배점|추가설명|모범)/u.test(line)).length >= 2;
      unresolved.push({ source: { file, start_line: page.start + 1, end_line: page.end, page: page.page },
        reason: likelyAnswer ? '발문 미검출 페이지: 이론·답안·해설 또는 이전 페이지 물음의 연속. 별도 출제 횟수로 세지 않음' : '발문 미검출 페이지: OCR 손상·사례/도표의 연속·목차·공백 여부와 질문형 종결 누락을 확인해야 함',
        text: null });
    }
  }
  // Every scanned page without a located demand is explicit, including pages containing only data.
  // Page-based uncertainty must never be silently represented as a zero frequency.
  return { source: { file, sha256: hash(bytes), pages: pages.length,
    coverage_note: `전체 ${pages.length}페이지 순회. 제외 ${stats.excluded_pages}쪽(표지·목차·PART2 해설), 발문 검출 ${stats.pages_with_requests}쪽, 발문 미검출 ${stats.pages_without_requests}쪽은 unresolved에 기록. 명령형/질문형 종결 기준 후보 추출이며 물음 전체·항목별 의미 분해의 완전성 보증 아님. source_role=question만 집계 대상으로 제공하고 이론·답안·목차를 출제요소로 생성하지 않음.` }, records, unresolved, stats };
}

function annotateDuplicates(records) {
  const groups = new Map();
  for (const record of records) {
    // OCR word wrapping and ordinary whitespace differences do not create another question.
    const normalized = record.text.replace(/\s+/gu, '').replace(/^[([]?물음\d+[)\]]?/u, '');
    const key = hash(normalized);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  for (const [key, group] of groups) if (group.length > 1) {
    // Generic instructions can be identical for distinct cases, so they are candidates only.
    const generic = group.some(record => record.notes.some(note => note.startsWith('지시어·항목형')));
    for (const record of group) record.notes.push(`${generic ? '동일 발문 중복 후보(사례 대조 필요)' : '공백 정규화 동일 발문'}: ${key.slice(0, 20)}; occurrences=${group.map(other => other.id).join(',')}`);
  }
  const origins = new Map();
  for (const record of records) {
    const { kind, year, problem, subquestion } = record.origin;
    if (!['mock', 'cpa_exam'].includes(kind) || year == null || !problem || !subquestion) continue;
    const key = `${kind}:${year}:${problem}:${subquestion}`;
    if (!origins.has(key)) origins.set(key, []);
    origins.get(key).push(record);
  }
  for (const [key, group] of origins) if (group.length > 1) for (const record of group) {
    record.notes.push(`동일 출제 원 ID 재수록/요구분할 후보: ${key}; occurrences=${group.map(other => other.id).join(',')}`);
  }
}

// Reviewed exemplars tie the general parser to actual prompt/answer boundaries. These
// overrides classify existing requests only; they neither alter source text nor add answers.
function applyReviewedExamples(result, repoDir) {
  const advanced = base + files[0], thematic = base + files[1];
  const definitions = [
    { file: thematic, replace: [508, 508], start: 513, end: 514, page: 17, local: 'thematic:p17:02:statement1',
      context: [508, 524], origin: { kind: 'unknown', year: null, problem: null, subquestion: null, item: null },
      elements: [{ label: '전문가적 의구심: 부정·오류 가능성, 의문을 갖는 마음과 감사증거의 비판적 평가를 포함하는 정의의 적절성 판단', topic_id: '02', kind: 'judgment' }],
      notes: ['표본 직접 대조: 원문 17쪽 OX 첫 진술. 발문은 적절할 때 이유를 요구하지 않음', '원기출 출처는 확인되지 않음; 원기출 식별과 발문 의미 추출 상태를 구분함'], status: 'extracted' },
    { file: thematic, start: 515, end: 515, page: 17, local: 'thematic:p17:02:statement2', context: [508, 524],
      origin: { kind: 'cpa_exam', year: 2023, problem: '1', subquestion: '1', item: '④' },
      elements: [{ label: '전문가적 의구심: 경영자가 부정직하다고 사전 가정해야 하는지 판단', topic_id: '02', kind: 'judgment' }, { label: '전문가적 의구심: 경영자의 부정직성 사전 가정에 대한 판단 근거 설명', topic_id: '02', kind: 'reason' }],
      notes: ['표본 직접 대조: 04_기출문제/기출문제_연도별_해설_A.md L4695-L4718의 2023년 문제1 물음1 항목④ 재수록', '03 원문 L546은240-13, 04 주제별 해설 L7819는240-12로 기재. 판본·문단표기 차이를 현재성 판단 없이 보존'], status: 'extracted' },
    { file: thematic, start: 516, end: 517, page: 17, local: 'thematic:p17:02:statement3', context: [508, 524],
      origin: { kind: 'unknown', year: null, problem: null, subquestion: null, item: null },
      elements: [{ label: '전문가적 의구심: 문서의 진실성을 의심할 사유가 있어도 진실한 것으로 인정하고 감사를 진행할 수 있는지 판단', topic_id: '02', kind: 'judgment' }, { label: '전문가적 의구심: 문서 신뢰성에 의문이 있는 상황의 판단 근거 설명', topic_id: '02', kind: 'reason' }],
      notes: ['표본 직접 대조: 원문 17쪽 OX 세 번째 진술; 문서 신뢰성 의심이라는 조건 보존', '원기출 출처는 확인되지 않음; 원기출 식별과 발문 의미 추출 상태를 구분함'], status: 'extracted' },
    { file: advanced, replace: [4077, 4077], start: 4077, end: 4077, page: 125, local: 'advanced:2024:GS1-6:1', context: [4055, 4077],
      origin: { kind: 'mock', year: 2024, problem: 'GS1-6', subquestion: '1', item: null },
      elements: [{ label: '퀵커머스 매출: 배송수수료30% 인식과 기사 광고비25% 지급 상황에서 추가 감사절차 제시', topic_id: '07', kind: 'procedure' }],
      notes: ['표본 직접 대조: 사실은L4057-L4074, 발문은L4077. 해설의 구체 절차를 요구요소로 역삽입하지 않음', '요구 개수 부근의 ^의상 OCR 훼손으로 개수는 미확인', 'PART1 주제별과 PART2 2024년 제1회 GS 문제6 재수록 관계; PART2 해설L17290-L17297은 출제 occurrence에서 제외'], status: 'needs_review' },
    { file: advanced, replace: [4079, 4079], start: 4078, end: 4079, page: 125, local: 'advanced:2024:GS1-6:2', context: [4055, 4079],
      origin: { kind: 'mock', year: 2024, problem: 'GS1-6', subquestion: '2', item: null },
      elements: [{ label: '퀵커머스 매출: 추가 감사절차 후 광고비 지급을 부정 징후로 판단한 이유 설명', topic_id: '05', kind: 'reason' }, { label: '퀵커머스 매출: 기사 광고비 지급 구조와 관련된 재무제표 효과 설명', topic_id: '05', kind: 'other' }],
      notes: ['표본 직접 대조: 물음1의 추가절차 후 부정 징후를 판단한 이유와 재무제표 효과를 각각 요구', '원자료 L4055에서 2024년 제1회 GS 문제6 표시'], status: 'extracted' },
    { file: advanced, replace: [4082, 4082], start: 4080, end: 4082, page: 125, local: 'advanced:2024:GS1-6:3', context: [4055, 4082],
      origin: { kind: 'mock', year: 2024, problem: 'GS1-6', subquestion: '3', item: null },
      elements: [{ label: '부정 관련 왜곡표시 식별: 경영진이 연루되지 않은 조건에서 감사기준상 감사절차 제시', topic_id: '05', kind: 'procedure' }, { label: '부정 관련 왜곡표시 식별: 경영진이 연루되지 않은 조건에서 외부감사법상 의무 제시', topic_id: '05', kind: 'procedure' }],
      notes: ['표본 직접 대조: 감사기준상 절차와 외부감사법상 의무를 분리하고 경영진 미연루 조건 보존', '현행 법령 판단·교재 정답 승인 없이 실제 발문의 요구만 기록'], status: 'extracted' },
  ];
  for (const example of definitions) {
    const lines = fs.readFileSync(path.join(repoDir, example.file), 'utf8').split(/\r?\n/u);
    const text = lines.slice(example.start - 1, example.end).join('\n');
    const expected = example.file === thematic ? /의구|부정직|감사절차의 성격/u : /한똑똑|재무제표 효과|실증절차/u;
    if (!expected.test(text)) {
      result.unresolved.push({ source: { file: example.file, start_line: example.start, end_line: example.end, page: example.page }, reason: '수동 대조 표본의 원문 위치가 변경됨: 재대조 전 자동 보정 금지', text });
      continue;
    }
    if (example.replace) result.records = result.records.filter(record => !(record.source.file === example.file && record.source.start_line <= example.replace[1] && record.source.end_line >= example.replace[0]));
    result.records.push({ id: `practice-${hash(`${example.file}\n${example.start}\n${example.end}\n${text}`).slice(0, 20)}`,
      source: { file: example.file, start_line: example.start, end_line: example.end, page: example.page }, source_role: 'question', text,
      context_source: { file: example.file, start_line: example.context[0], end_line: example.context[1], page: example.page }, local_question_id: example.local,
      origin: example.origin, elements: example.elements, status: example.status, notes: example.notes });
  }
  result.records.sort((a, b) => files.indexOf(path.basename(a.source.file)) - files.indexOf(path.basename(b.source.file)) || a.source.start_line - b.source.start_line);
}

function applyDemandCuration(result) {
  for (const [name, curation] of [['advanced', advancedCuration], ['thematic', thematicCuration]]) {
    const file = base + files[name === 'advanced' ? 0 : 1];
    for (const [line, reason] of Object.entries(excludedDemandLines[name])) {
      result.records = result.records.filter(record => {
        if (record.source.file !== file || record.source.start_line > Number(line) || record.source.end_line < Number(line)) return true;
        result.unresolved.push({ source: record.source, reason: `대조 후 비발문으로 제외: ${reason}`, text: record.text });
        return false;
      });
    }
    for (const [line, tuples] of Object.entries(curation)) {
      const record = result.records.find(record => record.source.file === file && record.source.start_line <= Number(line) && record.source.end_line >= Number(line));
      if (!record) throw new Error(`Reviewed demand anchor missing: ${file}:${line}`);
      record.elements = tuples.map(([topic_id, kind, label]) => ({ label, topic_id, kind }));
      record.status = 'extracted';
      record.notes = record.notes.filter(note => !/지시어·항목형|구체 대상·조건|上|상위 주제|원문 문제·물음 번호 일부|기출·GS·자체제작 구분|문장 앞뒤 연속성|발문에 OCR/u.test(note));
      record.notes.push(`발문 요구 의미 대조 완료: 원문 L${line}의 개념·주체·조건·요구행위로 재정리. 원기출 식별 미확정과 요소 추출 상태는 구분함`);
      if (!record.origin.problem || record.origin.year === null) record.notes.push('원기출 식별 미확정: 출처 유형·연도·문제번호 없는 값을 추정하지 않음');
    }
  }
  // Part2 decisions are replayed only from the reviewed reprint ledger.

}

function repairReviewedContinuations(result, repoDir) {
  for (const [name, repairs] of Object.entries(demandContinuationEnds)) {
    const file = base + files[name === 'advanced' ? 0 : 1];
    const lines = fs.readFileSync(path.join(repoDir,file),'utf8').split(/\r?\n/u);
    for (const [anchor, end] of Object.entries(repairs)) {
      const record = result.records.find(record=>record.source.file===file && record.source.start_line<=Number(anchor) && record.source.end_line>=Number(anchor));
      if(!record)throw new Error(`Missing reviewed continuation ${file}:${anchor}`);
      if(record.source.end_line>=end)continue;
      const previous=record.id;
      record.source.end_line=end;record.text=lines.slice(record.source.start_line-1,end).join('\n');
      record.id=`practice-${hash(`${file}\n${record.source.start_line}\n${end}\n${record.text}`).slice(0,20)}`;
      record.context_source.end_line=Math.max(record.context_source.end_line,end);
      record.notes.push(`원문 단서 연속행 직접 대조 보정: 이전 후보 ${previous}, 종료행 L${anchor}→L${end}`);
    }
    if(name==='thematic')for(const [anchor,[start,end]] of Object.entries(thematicContexts)){
      const record=result.records.find(record=>record.source.file===file&&record.source.start_line<=Number(anchor)&&record.source.end_line>=Number(anchor));
      if(!record)throw new Error(`Missing reviewed context ${file}:${anchor}`);
      const page=Number(lines.slice(0,start).filter(line=>/^## 원문 페이지 /u.test(line)).at(-1).match(/\d+/u)[0]);
      record.context_source={file,start_line:start,end_line:end,page};
    }
  }
}

function addReviewedMissingDemands(result, repoDir) {
  const file = base + files[1];
  const lines = fs.readFileSync(path.join(repoDir, file), 'utf8').split(/\r?\n/u);
  for (const [page, start, end, from, to] of [[528,15716,15720,15716,15751],[579,17241,17242,17215,17242],[618,18484,18488,18484,18488],[728,22270,22276,22270,22276],[777,24777,24778,24754,24778],[847,27216,27255,27216,27255],[848,27261,27282,27261,27282]]) {
    if (result.records.some(record => record.source.file === file && record.source.start_line <= start && record.source.end_line >= end)) continue;
    const text = lines.slice(start - 1, end).join('\n');
    result.records.push({ id: `practice-${hash(`${file}\n${start}\n${end}\n${text}`).slice(0,20)}`,
      source: { file, start_line: start, end_line: end, page }, source_role: 'question', text,
      context_source: { file, start_line: from, end_line: to, page }, local_question_id: `thematic:p${page}:L${start}`,
      origin: { kind: 'unknown', year: null, problem: null, subquestion: page === 847 ? '2' : page === 848 ? '3' : page === 728 ? '1' : null, item: null },
      elements: [], status: 'needs_review', notes: ['원문 직접 대조로 명령문 줄바꿈·OCR 종결·공통 지시 아래 연속 표 누락 보정', '별도 후반 의미 대조 overlay에서 구체 요구요소를 확정함'] });
  }
  result.records.sort((a,b) => files.indexOf(path.basename(a.source.file)) - files.indexOf(path.basename(b.source.file)) || a.source.start_line - b.source.start_line);
}

function addReviewedReprintSources(result, repoDir) {
  const mapping = JSON.parse(fs.readFileSync(path.join(repoDir, 'cpa_uploader/analysis/question-elements/practice-reprint-missing.json'), 'utf8'));
  const file = base + files[0];
  const bytes = fs.readFileSync(path.join(repoDir, file));
  if (mapping.source_hashes[file] !== hash(bytes)) throw new Error('Reviewed reprint mapping has stale source hash');
  const lines = bytes.toString('utf8').split(/\r?\n/u);
  const pageAt = line => Number(lines.slice(0,line).filter(text=>/^## 원문 페이지 /u.test(text)).at(-1)?.match(/\d+/u)[0]);
  for (const entry of mapping.missing_sources) {
    const start = entry.source_start_line, end = entry.source_end_line;
    if (start === null) continue;
    const existing = result.records.find(record=>record.source.file===file && record.source.start_line<=end && record.source.end_line>=end);
    // A previously extracted range may omit the shared introduction; retain its ID.
    if (existing) continue;
    const text = lines.slice(start-1,end).join('\n');
    const page = pageAt(start);
    const earlier = lines.slice(Math.max(0,start-151),start-1);
    const header = earlier.findLastIndex(line=>/GS\s*모의고사\s*문제/u.test(line));
    const contextStart = header >= 0 ? Math.max(1,start-150)+header : Math.max(1,start-45);
    result.records.push({id:`practice-${hash(`${file}\n${start}\n${end}\n${text}`).slice(0,20)}`,
      source:{file,start_line:start,end_line:end,page},source_role:'question',text,
      context_source:{file,start_line:contextStart,end_line:end,page:pageAt(contextStart)},local_question_id:`advanced:p${page}:L${start}`,
      origin:{...entry.origin},elements:entry.elements.map(element=>({...element})),status:'extracted',
      notes:[...entry.notes,'발문 요구 의미 대조 완료: 원문 명령어 내부 줄바꿈·단락 분리로 누락된 Part1 실제 요구를 직접 대조하여 복원함']});
  }
  // These corrections are backed by the printed Part2 original exam, including
  // Part1 chapter-local renumbering. They do not combine similarly worded exams.
  const subquestions = {1335:'1',6068:'5',357:'2',9186:'4',9191:'5',6252:'4',6273:'7',3302:'7'};
  for (const [end,subquestion] of Object.entries(subquestions)) {
    const record=result.records.find(record=>record.source.file===file&&record.source.start_line<=Number(end)&&record.source.end_line>=Number(end));
    if(!record) throw new Error(`Reviewed original question missing: L${end}`);
    record.origin.subquestion=subquestion;
    record.notes.push(`동일 원시험 Part2 명시 번호 대조: Part1 장별 재번호화·OCR 오류를 원물음 ${subquestion}으로 정정`);
  }
  const deliveryCase = result.records.find(record=>record.source.file===file&&record.source.end_line===4077);
  if (!deliveryCase || !lines[12304].includes('감사절차를 3줄 이상 서술하시오')) throw new Error('Reviewed delivery-case counterpart changed');
  deliveryCase.status='extracted';
  deliveryCase.notes=deliveryCase.notes.filter(note=>!note.includes('요구 개수 부근'));
  deliveryCase.notes.push('Part1 L4077의 ^의상 OCR 훼손을 동일 원시험·동일 퀵커머스 사례의 Part2 L12304–12305와 직접 대조: 원문 지시는 항목 개수가 아닌 3줄 이상 서술. source 인용 자체는 원문 그대로 보존함');
  result.records.sort((a,b)=>files.indexOf(path.basename(a.source.file))-files.indexOf(path.basename(b.source.file))||a.source.start_line-b.source.start_line);
}

function recordRemainingOcrGaps(result, repoDir) {
  const file=base+files[1];
  const lines=fs.readFileSync(path.join(repoDir,file),'utf8').split(/\r?\n/u);
  for(const [end,start,note] of [
    [2216,2207,'원문 L2214–2216 요구사항2의 본문이 7 고 0으로 유실되어 대상·요구행위를 확정할 수 없음. 뒤의 토의 효익 요구는 별도 연속 인용으로 보존함'],
    [11034,11024,'원문 L11029–11032 감사인측 보험계리 전문가 활용 사례의 핵심 후속 조건이 유실됨. 절차·이유를 요구함은 읽히지만 어떤 조건에 대한 요구인지 답안에서 역으로 채우지 않음'],
    [11667,11654,'원문 L11660–11665 현금계정 감사조서의 밑줄 친 은행조회 사례가 유실됨. 문제점2개·보완절차 요구는 읽히지만 실제 두 조건을 확정할 수 없음'],
  ]) {
    const record=result.records.find(record=>record.source.file===file&&record.source.end_line===end);
    if(!record)throw new Error(`Missing known OCR gap L${end}`);
    record.elements=[];
    record.notes=[note,'원문 직접 대조 완료: 해설 내용이나 인근 이론을 훼손된 실제 발문으로 대체하지 않음'];
    const page=Number(lines.slice(0,start).filter(line=>/^## 원문 페이지 /u.test(line)).at(-1).match(/\d+/u)[0]);
    record.context_source={file,start_line:start,end_line:end,page};
  }
  for(const [start,end,status,elements,note] of [
    [2209,2213,'needs_review',[{label:'중요왜곡표시 가능성 관련 업무팀 토의에 참여할 업무팀원 선정',topic_id:'06',kind:'list'}],'요구사항1의 첫 번째 참여자 선정 요구는 읽히지만 두 번째 요구 본문이 L2212–2213에서 OCR 유실되어 전체 요구를 확정할 수 없음'],
    [2217,2218,'extracted',[{label:'재무제표 중요왜곡표시 가능성에 관한 업무팀 내부 토의의 효익 제시',topic_id:'06',kind:'list'}],'명령어 OCR 훼손으로 자동 탐지되지 않은 실제 연속 발문을 원문 직접 대조하여 복원. 효익 요구의 대상·행위는 명료하며 답안 분량 글자만 훼손됨'],
  ]) {
    const text=lines.slice(start-1,end).join('\n');
    result.records.push({id:`practice-${hash(`${file}\n${start}\n${end}\n${text}`).slice(0,20)}`,
      source:{file,start_line:start,end_line:end,page:74},source_role:'question',text,
      context_source:{file,start_line:2207,end_line:end,page:74},local_question_id:`thematic:p74:L${start}`,
      origin:{kind:'unknown',year:null,problem:null,subquestion:null,item:null},elements,status,notes:[note]});
  }
  for(const end of [2213,2216,11034,11667,24778]) {
    const record=result.records.find(record=>record.source.file===file&&record.source.end_line===end);
    if(!record)throw new Error(`Missing recorded OCR review gap L${end}`);
    result.unresolved.push({record_id:record.id,source:record.source,text:record.text,
      reason:end===24778?'원문 p777 대화 중간 L24761–24773 OCR 유실로 오류3개 선택의 전체 조건을 확인할 수 없음':record.notes[0]});
  }
  result.records.sort((a,b)=>files.indexOf(path.basename(a.source.file))-files.indexOf(path.basename(b.source.file))||a.source.start_line-b.source.start_line);
}

export function extractPractice({ repoDir = repository } = {}) {
  const result = { version: 1, sources: [], records: [], unresolved: [] };
  for (const name of files) {
    const file = base + name;
    const extracted = extractFile(file, fs.readFileSync(path.join(repoDir, file)));
    result.sources.push(extracted.source); result.records.push(...extracted.records); result.unresolved.push(...extracted.unresolved);
  }
  applyReviewedExamples(result, repoDir);
  addReviewedMissingDemands(result, repoDir);
  repairReviewedContinuations(result, repoDir);
  applyDemandCuration(result);
  addReviewedReprintSources(result, repoDir);
  recordRemainingOcrGaps(result, repoDir);
  annotateDuplicates(result.records);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some(argument => argument !== '--check')) throw new Error('Usage: node extract-practice.mjs [--check]');
  const result = extractPractice();
  const output = JSON.stringify(result, null, 2) + '\n';
  const target = path.join(directory, 'practice.json');
  if (arguments_.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('practice.json is not synchronized with source files/extractor');
  } else fs.writeFileSync(target, output, 'utf8');
  console.log(JSON.stringify({ sources: result.sources.length, records: result.records.length, elements: result.records.reduce((total, record) => total + record.elements.length, 0), unresolved: result.unresolved.length,
    statuses: Object.fromEntries(['extracted', 'needs_review'].map(status => [status, result.records.filter(record => record.status === status).length])) }, null, 2));
}
