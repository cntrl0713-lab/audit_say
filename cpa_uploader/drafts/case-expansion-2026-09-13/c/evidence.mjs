import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';
const D = 'cpa_uploader/drafts/case-expansion-2026-09-13';
const read = f => JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8'));
const bank = read('bank-before.json'), sets = read('c/sets.json'), catalog = read('catalog-before.json'), source = read('source-catalog.json');
const sha = x => createHash('sha256').update(x).digest('hex');
const clean = x => x.replace(/\s+/gu, '');
const fileHashes = new Map();
const fileHash = f => {if (!fileHashes.has(f)) fileHashes.set(f, sha(fs.readFileSync(f)));return fileHashes.get(f);};
const pages = (file, numbers) => source.units.filter(u => u.file.endsWith(file) && numbers.includes(u.page));
const evidence = u => ({source_unit_id:u.id, authority:u.authority, source_id:u.sourceId, file:u.file, file_sha256:fileHash(u.file), unit_quote_sha256:sha(u.quote), page:u.page, start_line:u.startLine, end_line:u.endLine, standard:u.standard, paragraph:u.paragraph, locator:u.locator, edition:u.edition, provenance:u.provenance, quote:u.quote});
const configs = {
  'pilot-16-011': {
    title:'보고서일 전후의 기타정보 미수정 대응', exam:[25,26,197,198], advanced:[195,197],
    origin:'2025년 기출 문제10 물음3, 고급연습 p195 물음3(해설 p197)의 보고서일 전후 구별을 참고하였다.',
    scope:'기출의 사업보고서 수정거부에 구체적인 영업손익 서술 오류를 부여하고, 보고서일 후 배포된 연차보고서의 미상환 차입금 서술과 수정거부를 독립 상황으로 추가하였다. 재무제표의 수정 필요와 감사증거 전반 신뢰성 훼손은 배제한다.',
    distinction:'sub1은 원래 3개 criterion 보존. exp1은 기존 일반론 sub2를 재분류한 것이 아니라, 배포된 연차보고서에서 수정거부가 지속되는 사실에 720.19(b)를 적용하는 2점 사례 물음이다. 기준서형 sub2는 통합 담당자가 별도 보존한다.',
    warnings:'기출 해설 p198에는 구720의 기타사항문단 답안이 함께 실려 있다. 이 표현을 재사용하지 않고 검증된 개정720.18·22(e)(ii)의 기타정보 단락을 사용했다. 고급연습의 선택식 정답 인정과 소수점 배점도 재사용하지 않는다.',
    facts:{sub1:['f1','f2'], exp1:['f1','f3']},
    questions:{
      sub1:{reason:'영업손실을 이익으로 서술한 기타정보 오류, 경영진·지배기구에 대한 수정요구 완료, 해지 불가와 증거 전반 문제 없음이 결합되어 18(a)의 보고·커뮤니케이션 경로를 선택한다. 의견 자동 거절 부정, 기타정보 단락 설명, 지배기구 보고계획 전달은 각각 독립1점이며 3점 유지. 이미 한 수정요구를 반복시키지 않는다.', partial:['기타정보의 중요한 미수정왜곡표시를 감사보고서의 기타정보 단락에 설명해야 한다.',['crit2']], wrong:'사업보고서의 수정거부가 있으면 재무제표 감사의견을 자동으로 거절하고 기타정보 단락에는 아무 것도 기재하지 않는다. 지배기구에는 이미 수정을 요구했으므로 보고계획을 알릴 필요가 없다.'},
      exp1:{reason:'감사보고서일 후 처음 입수한 연차보고서가 배포되고 지배기구와 논의한 뒤에도 차입금 상환 오기가 미수정이라는 19(b)의 전제가 충족한다. 법적 권리·의무 고려와 이용자 주의환기 조치는 독립하여 각1점. 특정 신고·재발행을 무조건 의무화하지 않는다.',partial:['후속 조치를 정할 때 감사인의 법적 권리와 의무를 고려한다.',['exp1.crit1']],wrong:'을은 감사보고서일 이후에 발견되었으므로 추가 조치를 하지 않고 종결한다. 투자자에게 알릴 필요도 없다.'}
    }
  },
  'pilot-16-012': {
    title:'계약 분쟁 핵심감사사항의 공시 예외', exam:[133,391], advanced:[207,209],
    origin:'2018년 기출 문제7 물음2의 핵심감사항목 생략 예외와 고급연습 p207 문제2 물음1의 보고서 문구 교정을 참고하였다. 현재 KGA701의 핵심감사사항 단락에 적용하며 당시 수주산업 강조사항 표시를 가져오지 않았다.',
    scope:'이미 핵심감사사항인 분쟁을 법규상 공시배제, 협상상 불이익만 주장, 동일 정보의 기존 공시 확인이라는 세 상황으로 구체화하였다.',
    distinction:'기존 sub1의 세 독립 상황을 sub1(갑1점), exp1(을2점), exp2(병1점)로 분리한다. 기존4개 criterion ID와 총4점을 모두 보존한다. 표준 문서화 물음 sub2는 통합 담당자가 보존하며 사례에 붙이지 않는다.',
    warnings:'경영진의 상업적 불이익 주장만으로 예외 충족을 단정하지 않으며, 극히 드문 상황·합리적 예상·공익적 효익을 훨씬 초과·감사인의 결정이라는 하나의 예외조건을 임의로 여러 점수로 쪼개지 않았다.',
    facts:{sub1:['f1','f2'], exp1:['f1','f3'],exp2:['f1','f4']},
    questions:{
      sub1:{reason:'법규에 의한 공개 배제를 확인한 갑은 14(a)에 직접 해당한다. 근거와 결론이 한 조건부 명제로 결합되어 기존1점 유지; 법규 확인을 판단 대신 별도1점으로 중복 배점하지 않는다.',wrong:'갑은 경영진 내부방침에 불과하므로 법규상 공시배제 여부와 관계없이 반드시 핵심감사사항으로 공개해야 한다.'},
      exp1:{reason:'협상 불이익 주장은 있으나 감사인의 비교평가가 미완료인 을은 요청만으로 생략 불가1점과 14(b)의 완결된 예외요건1점을 구별한다. 예외조건을 정확히 설명하면 요청만으로 부족하다는 판단을 함축할 수 있다.',partial:['을은 경영진이 원한다는 이유만으로 생략할 수 없다.',['sub1.crit2']],wrong:'을은 경영진이 협상에 불리하다고 요청하였으므로 감사인이 별도로 평가하지 않고 생략하여야 한다.'},
      exp2:{reason:'이미 같은 분쟁 정보가 공시된 병은 14(b) 말문의 제외조건에 해당한다. 이전 공시라는 사실과 해당 예외 미적용을 하나의 직접 결론으로 평가하여 기존1점 유지한다. 법규공시금지까지 무력화된다는 확대 답안은 인정하지 않는다.',wrong:'병도 공익적 효익보다 손해가 클 것 같으면 이미 공시한 정보인지와 관계없이 14(b)에 따라 생략할 수 있다.'}
    }
  },
  'pilot-14-008': {
    title:'그룹 보고한도와 부문중요성의 산술배분',exam:[41,53,226],advanced:[249,251],
    origin:'2023년 기출 문제7 물음3의 한도결정 위임 및 합계 일치 요구, 2024년 기출 문제9 중요성 물음과 고급연습 p249 물음4④·p251 해설을 참고하였다.',
    scope:'현지 법정감사 한도를 그룹 보고한도로 그대로 쓰려는 부문감사인, 개별 금액은 그룹 전체 중요성보다 낮으나 합계가 초과한 계획을 예산처럼 일률 축소하려는 팀원의 제안을 구체화하였다.',
    distinction:'기존 sub2·sub3의 5개 criterion 유지. 일반론 sub1(법정 부문감사의 두 중요성 검증)은 별도 보존되므로 그 사실을 되붙이지 않는다.',
    warnings:'부문중요성이 일정 비율이어서는 안 된다는 절대금지가 아니라 일정 비율의 배분 의무가 없다는 의미다. 실제 우연히 합계가 같아지는 경우까지 금지하지 않는다.',
    facts:{sub2:['f1','f2'],sub3:['f1','f3']},
    questions:{
      sub2:{reason:'현지 법정감사 한도를 근거로 부문감사인이 그룹업무팀 결정을 생략하려는 제안은 600.21 머리말·(d)에 반한다. 부적절 판단과 그룹업무팀 책임을 독립 각1점 유지하며, 주체를 정확히 설명하면 부적절 판단도 함축할 수 있다.',partial:['상황 가의 제안은 부적절하다.',['sub2.crit1']],wrong:'상황 가는 적절하다. 그룹 보고한도는 부문감사인이 그룹업무팀과 무관하게 최종 결정한다.'},
      sub3:{reason:'개별 부문금액은 모두 전체 중요성 미만이라는 조건을 주어 개별한도 위반과 합계초과를 혼동하지 않게 했다. 일치의무 주장의 부적절 판단1점, 일정비율 배분 의무 없음1점, 합계초과 가능1점으로 기존3점 유지한다.',partial:['상황 나에서 합계를 무조건 일치시키자는 제안은 부적절하다.',['sub3.crit1']],wrong:'모든 부문중요성의 합은 그룹재무제표 전체 중요성과 반드시 같아야 하므로 일률적으로 줄이는 제안은 적절하다.'}
    }
  },
  'pilot-14-007': {
    title:'재무적 유의성·외화파생위험·증거부족에 따른 부문 업무',exam:[25,52],advanced:[240,241,242],
    origin:'2023년 기출 문제7의 부문 A/B/C와 유의적이지 않은 부문 D 선정, 2025년 기출 문제9 물음3의 증거부족 대응 및 고급연습 p240~242 그룹종합문제의 부문별 실제 업무판단을 참고하였다.',
    scope:'A의 주력제조 규모, B의 집중 외화파생거래 위험, C군의 증거부족과 고정 순환 제안을 추가하여 세 판단을 구체화하였다. 재무적 유의성 산술계산은 요구하지 않는다.',
    distinction:'기존 sub1~3의 9개 criterion ID와 점수를 보존한다. B 위험에 한정하는 두 대안의 claim에는 외화파생계약 측정·공시 위험과 연결하는 조건을 명시하여 일반론만으로 사례 적용을 대신하지 못하게 했다. 일반론 sub4는 별도 보존.',
    warnings:'27의 세 가지 대안은 모두 쓰되 실제 세 가지를 전부 수행하라는 의무로 바꾸지 않는다. C의 증거부족이라는 조건에서 추가선정·기간별 변경을 요구한다.',
    facts:{sub1:['f1','f2'],sub2:['f1','f3'],sub3:['f1','f4']},
    questions:{
      sub1:{reason:'개별적으로 재무적 유의성이 있는 A에는 600.26의 부문재무정보 감사와 부문중요성이 적용된다. 업무유형과 사용할 중요성은 분리 가능한 답으로 각1점, 기존2점 유지.',partial:['A 부문의 재무정보 전체에 대한 감사를 수행한다.',['sub1.crit1']],wrong:'A는 규모만 크므로 그룹 수준 분석적절차만 실시하고 그룹재무제표 전체 중요성을 그대로 적용하면 된다.'},
      sub2:{reason:'개별 재무적 유의성은 없지만 외화파생위험 때문에 유의적인 B에는 27·A48·A49 적용. 3업무대안 각1점, 전체감사시 부문중요성1점, 하나이상 선택수행 원칙1점=기존5점. 모두 B에 대한 업무선택이라는 한 목표이며 일반론 다른 목록까지 붙이지 않았다.',partial:['B의 재무정보 전체를 감사하는 대안을 택할 수 있으며 이때 부문중요성을 사용한다.',['sub2.crit1','sub2.crit4']],wrong:'B는 개별적인 재무적 유의성이 없으므로 외화파생계약 위험과 관계없이 그룹 수준 분석적절차만 하면 된다.'},
      sub3:{reason:'필수수준 업무만으로 증거부족이 예상되는 C군은 29의 추가 부문추출 전제가 충족된다. 일부부문 선정과 기간경과에 따른 변경은 독립조치 각1점. 고정선정 주장을 지문에 두어 순환원칙이 사례사실과 연결된다.',partial:['C군의 유의적이지 않은 부문 중 일부를 추가 업무 대상으로 선정한다.',['sub3.crit1']],wrong:'유의적이지 않은 C군에서는 추가로 선정할 부문이 없으며 앞으로도 어떤 부문도 검사하지 않는다.'}
    }
  },
  'pilot-10-007': {
    title:'이자비용 기대치의 정확성과 감면 설명 검증',exam:[37,221],advanced:[127,129],
    origin:'2024년 기출 문제7 물음2의 이자비용 분석절차 보완과 고급연습 p127 물음1의 기대치-장부차이 및 차입금 관련 절차 검토(해설 p129)를 참고하였다.',
    scope:'가의 월별 계약조건이 다른 변동금리 차입금과 연간 평균계산 종결, 나의 유의적 차이에 대한 이자감면 주장과 은행 확인자료 불일치를 서로 독립적인 단계로 구성하였다.',
    distinction:'기존 사례 sub2의 3criterion 보존. 새 exp1은 기존 기준서형 sub3의 520.7 지식을 구체적인 감면 설명과 확보증거의 불일치에 적용하는 심화2점. 기존 일반론 sub1·sub3·sub4는 통합 담당자가 보존.',
    warnings:'자료 신뢰성은 이미 별도 평가했다는 전제로 중복 요구하지 않는다. 연간 평균이라 언제나 부적합하다는 결론도 제시하지 않는다. 나의 기타감사절차는 실제 설명이 뒷받침되지 않는 경우에 요구한다.',
    facts:{sub2:['f1','f2'],exp1:['f1','f3']},
    questions:{
      sub2:{reason:'적합성과 자료신뢰성은 완료된 가에서 누락된 정확성 평가·수용차이 결정을 요구한다. 부적절 판단1, 중요왜곡표시를 식별할 정도의 정확성 평가1, 차이금액 결정1=기존3점. 기대치 평가나 차이기준 설정의 필요성을 설명하면 종결부적절 판단을 함축한다.',partial:['가에서 현재 계산값만으로 절차를 끝내는 계획은 부적절하다.',['crit4']],wrong:'계산값과 장부금액이 비슷하므로 가의 종결은 적절하다. 기대치의 정확성과 수용 차이금액은 따로 검토할 필요가 없다.'},
      exp1:{reason:'유의적 차이와 수용범위 초과, 감면 주장, 은행확인자료 미반영·약정 미제시를 연결하여 520.7·A20·A21 적용. 관련증거를 통한 설명평가와 현재 증거불일치에 필요한 기타절차는 독립1점씩. 제시 예시는 동등한 구체 절차로 대체 가능하다.',partial:['은행으로부터 변경된 이자감면 약정이나 확인을 입수하여 경영진의 감면 설명을 평가한다.',['exp1.crit1']],wrong:'은행 확인자료가 감면 설명과 달라도 경영진에게 질문했으므로 추가 증거와 다른 절차 없이 나의 차이조사를 종결한다.'}
    }
  },
  'pilot-10-006': {
    title:'매출채권 표본의 수용·기각 오류와 감사 영향',exam:[143,157,427],advanced:[110,111,112],
    origin:'2016년 기출 문제4 물음1·2의 표본위험 형태·효과성/효율성, 2017년 기출 문제4의 매출채권 표본감사, 고급연습 p110~112의 매출채권 금액가중표본 사례를 참고하였다.',
    scope:'모집단은 소액다수 매출채권, 절차는 실재성 조회·증빙검사이며 모든 단위에 추출기회가 있고 적용·해석오류는 없다는 사실을 추가하였다. A는 미선정 거래처의 가공채권, B는 표본에 집중된 비실재채권이라는 독립상황이다.',
    distinction:'기존 사례 sub1·sub2의 6criterion 유지. 원자료의 수치·표본계산은 도입하지 않았고 표본과 전체모집단 결론 차이가 의미하는 위험과 그 영향만 적용한다. 기준서형 후속대응 sub3는 별도 보존.',
    warnings:'고급연습의 금액가중표본 사례는 적용대상·맥락의 인접 참고이며 동일한 위험분류 발문이 있었다고 기록하지 않는다. 2016년 해설의 손해배상금 비교 설명 대신 530.5(c)의 부적합의견·효과성 직접근거를 사용한다.',
    facts:{sub1:['f1','f2','f3'],sub2:['f1','f2','f3']},
    questions:{
      sub1:{reason:'A는 실제중요왜곡 있음/표본결론 없음이므로 부당수용, B는 그 반대인 부당기각이다. 각 상황 분류는 독립1점. 모집단 상태 반복은 분류가 아니며 동의명칭(부당거부 등)은 인정한다.',partial:['A는 부당수용위험이다.',['crit1']],wrong:'A는 부당기각위험이고 B는 부당수용위험이다.'},
      sub2:{reason:'A의 놓친 가공채권에서 효과성 저해와 부적합의견 가능성, B의 과도한 표본결론에서 효율성 저해와 확인추가업무라는 결과·경로를 대응한다. 4독립명제 각1점 유지; 명칭을 다시 쓰는 것은 별도득점 없음.',partial:['A는 중요한 왜곡표시를 놓쳐 감사의 효과성을 저해하고 부적합한 감사의견으로 이어질 수 있으므로 특히 유의해야 한다.',['crit3','crit7']],wrong:'A는 불필요한 재검사만 늘려 효율성을 저해하지만 의견의 적정성과는 무관하다. B는 중요한 왜곡표시를 놓쳐 감사의 효과성을 저해한다.'}
    }
  },
  'pilot-15-006': {
    title:'의견거절 보고서의 의견·감사인책임 단락 수정',exam:[41,42,229],advanced:[232,233,235],
    origin:'2024년 기출 문제10 물음3(2)의 의견거절 의견단락 수정과 고급연습 p232 문제11 물음1의 보고서 초안 교정, p235 책임단락 해설을 참고하였다. p351은 같은 문제 재수록으로 별도출제로 세지 않는다.',
    scope:'원 의견단락의 잘못된 제목·감사완료·적정의견·증거충분 문장을 유지하고, 적정의견용 상세책임 복사 및 책임·증거한계·독립성 문구 삭제라는 작성자의 오류를 추가하였다.',
    distinction:'기존 sub1의 4criterion 유지, 새 exp1은 책임단락의 세 내용으로3점을 추가하였다. 일반론인 기존 sub2의 KAM/기타정보 단락 허용은 별도 보존. 통합감사·추가보고문단 등 고급 원문 다른 요구는 제외.',
    warnings:'증거미입수는 발견된 확정왜곡표시와 다르다. 책임단락의 증거미입수는 705.28(b)의 요구이며, 의견단락의 19(b)와 같은 내용을 적더라도 서로 다른 보고서 위치의 교정을 묻는 독립 물음이다.',
    facts:{sub1:['f1','f2','f3'],exp1:['f1','f3']},
    questions:{
      sub1:{reason:'의견거절이라는 결론은 전제로 주고 초안의4오류를 705.16·19에 맞게 고친다. 제목, 감사계약체결, 의견미표명, 유의성에 따른 충분적합증거 미입수는 독립 각1점 유지. 적절한 재무제표 명세나 다른 단락은 채점하지 않는다.',partial:['제목은 의견거절로 고친다. 문장 가는 재무제표에 대한 감사계약을 체결하였다고 고친다.',['sub1.crit1','sub1.crit2']],wrong:'제목과 문장 가·다·라는 모두 적절하다. 감사증거를 충분히 확보했고 적정의견을 표명하였다고 그대로 둔다.'},
      exp1:{reason:'705.28의 세 내용만으로 책임설명을 축소하는 초안교정이다. 감사수행·보고발행 책임, 거절근거로 인한 증거미입수, 관할 윤리기준에 따른 독립성·기타윤리책임은 각 완결된1점으로3점. 독립성만 써 놓고 다른윤리책임을 누락하면 세 번째 명제는 충족하지 않는다.',partial:['상세한 표준 책임 설명은 축소하고, 감사기준에 따라 라온산업의 재무제표를 감사하고 감사보고서를 발행할 책임이 있다고 기술한다.',['exp1.crit1']],wrong:'의견거절이면 감사인의 책임 단락은 모두 삭제한다. 감사수행·보고서발행 책임이나 증거미입수의 한계를 설명할 필요가 없고 독립성과 윤리적 책임도 없다.'}
    }
  }
};

const qa = [], designs = [], reviews = [];
for(const s of sets) {
  const config=configs[s.id], before=bank.find(x=>x.id===s.id);
  const official=s.source_refs.map(r=>{
    const u=source.units.find(u=>u.file===r.file&&clean(u.quote)===clean(r.source_quote));
    if(!u)throw new Error(`No real catalog match ${s.id}/${r.id}`);
    return {...evidence(u),source_ref_id:r.id};
  });
  const learning=[...pages('기출문제_연도별_해설_B.md',config.exam),...pages('고급_회계감사_연습.md',config.advanced)].map(evidence);
  const dependencies=source.units.filter(u=>u.authority==='official_transcription' && (
    (s.id==='pilot-16-011'&&['src-8b8347593d4751af13','src-5baf207e02260d3a4e','src-5ed4fb992a449d3feb','src-ecd66fe6856a4db2c1','src-109a2b1ec422897a66'].includes(u.id)) ||
    (s.id==='pilot-16-012'&&['src-1acadd03d8bd606be7','src-d155d402204c8d177d','src-379ee43d5f99e60dd7','src-7c1cfc599878c7c6b6','src-96352d2066d8de2f84'].includes(u.id)) ||
    (s.id==='pilot-14-007'&&u.file.endsWith('kga600-2025-review14.txt')&&['9','21','A43','A44','A48','A49','A50','A51','A53'].includes(u.paragraph))
  )).map(evidence);
  const plan={version:1,topic_id:s.classification.topic_id,mode:'adapt_existing_question',objective:config.title,
    scope:{actors:['사례에 명시된 감사인·경영진·지배기구 및 해당하는 경우 그룹업무팀·부문감사인'],timing:['2026년 개시 보고기간의 감사 및 2027년 후속 업무. 구체 보고서일 전후는 사례별 사실을 적용한다.'],conditions:s.shared_context.facts.map(f=>f.text),exceptions:[config.warnings],required_answers:s.subquestions.map(q=>q.prompt),exclusions:['원자료의 계산·선택출제·줄수제한은 도입하지 않음. 분리된 기준서형 물음은 사례 아래에 포함하지 않음. '+config.distinction]},
    question_types:[...new Set(s.subquestions.map(q=>q.type))],source_unit_ids:[...new Set([...official,...learning,...dependencies].map(x=>x.source_unit_id))],existing_question_difference:config.distinction,
    edition_assumption:before.verification.notes[0],unresolved_items:[],status:'ready'};
  const pe=validateQuestionAuthoringPlan(plan);if(pe.length)throw new Error(pe.join('\n'));
  const lineage=s.subquestions.flatMap(q=>q.criteria.map(c=>{const oldQ=before.subquestions.find(x=>x.criteria.some(y=>y.id===c.id)); const oldC=oldQ?.criteria.find(x=>x.id===c.id); return {criterion_id:c.id,old_subquestion_id:oldQ?.id??null,new_subquestion_id:q.id,old_points:oldC?.max_points??0,new_points:c.max_points,change:oldC?(oldC.claim===c.claim?'preserved':'case_application_clarified'):'new',reason:config.questions[q.id].reason};}));
  const design={set_id:s.id,plan,origin:config.origin,new_scope:config.scope,source_limitations:config.warnings,learning_sources:learning,official_sources:official,official_dependencies:dependencies,facts_to_questions:Object.entries(config.facts).map(([subquestion_id,fact_ids])=>({subquestion_id,fact_ids,reason:config.questions[subquestion_id].reason})),criterion_lineage:lineage};
  if(s.id==='pilot-15-006') {
    const file='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt';
    const lines=fs.readFileSync(file,'utf8').split(/\r?\n/u);
    design.official_uncatalogued_dependency={file,file_sha256:fileHash(file),standard:'KGA 705',paragraph:'A25',start_line:31516,end_line:31523,quote:lines.slice(31515,31523).join('\n'),role:'기존 2025 공식 PDF 추출의 적용자료 직접 확인; 새로운 source_unit ID를 만들지 않음'};
  }
  designs.push(design);
  const qReviews=[];
  for(const q of s.subquestions) {
    const conf=config.questions[q.id], total=q.criteria.reduce((n,c)=>n+c.max_points,0);
    const partial=conf.partial;
    if(partial)qa.push({set_id:s.id,subquestion_id:q.id,kind:'partial',answer:partial[0],expected_points:q.criteria.filter(c=>partial[1].includes(c.id)).reduce((n,c)=>n+c.max_points,0),met_criterion_ids:partial[1],reason:'선정한 독립 명제만 충족한다. 나머지는 답안 전체의 명시·함축으로 충족되지 않는다. '+conf.reason});
    qa.push({set_id:s.id,subquestion_id:q.id,kind:'wrong',answer:conf.wrong,expected_points:0,met_criterion_ids:[],reason:'사례의 핵심 조건에 반대되는 명시적 결론 또는 조치이다. 맞는 독립 근거가 함께 포함되지 않아 0점으로 설정했다.'});
    qReviews.push({subquestion_id:q.id,question_style:'case',topic_ids:q.topic_ids,fact_ids:config.facts[q.id],classification_reason:conf.reason,
      minimum_sufficient_answer:q.model_answer,model_answer_review:{status:'pass',expected_points:total,reason:'저장된 모범답안을 요구·조건과 아래 각 criterion의 직접 근거에 대조했다. 모든 독립 명제를 충족하며 지문 밖 결론·예외를 요구하지 않는다.'},point_review:{decision:q.id.startsWith('exp')?'split_or_added':'keep',max_points:total,reason:conf.reason},
      criteria:q.criteria.map(c=>({criterion_id:c.id,claim:c.claim,points:c.max_points,source_ref_ids:c.source_ref_ids,source_unit_ids:c.source_ref_ids.map(id=>official.find(x=>x.source_ref_id===id).source_unit_id),requirement_id:c.requirement_id,source_support:'직접 원문이 지지하는 조건부 명제를 사례의 명시적 사실에 적용함. '+conf.reason,answer_and_condition_review:'모범답안에서 이 명제를 확인하였고, 동의 표현 및 명확한 함축을 허용한다. 명시적 반대는 이 기준만 0점이며 독립적으로 맞는 다른 기준을 일괄 감점하지 않는다.',independent_meaning_review:'동일 명제를 단어·문장수로 나누지 않고 완결된 명제 1점으로 유지한다. 다른 criterion과 중복 없이 해당 요구만 충족하면 인정한다.',result:'pass'})),
      boundary_review:{empty_answer_points:0,explicit_opposite:'대표 오답에 보존. 맞는 독립 근거가 없는 전체 반대 답안을 선택함.',implied_conclusion:'적절성 판단을 요구하는 경우 조치·이유가 반대 계획의 부적절함을 분명히 함축하면 판단도 인정한다. 결론 단어를 지운 답을 자동 부분답안으로 만들지 않음.',missing_one_claim:'대표 부분답안의 나머지 답안에서 누락 명제를 함축하지 않는지 대조함. 1점 물음은 부분점수 없음.'},unresolved:[]});
  }
  reviews.push({set_id:s.id,reviewer:'Codex c 담당 agent',execution_kind:'agent_content_review',source_comparison_completed:true,model_api_semantic_review:'not_run',actual_grading:'root_pending',human_review:'not_claimed',fact_text_chars:s.shared_context.facts.map(f=>f.text).join('\n').length,case_question_count:s.subquestions.length,source_notes:config.warnings,questions:qReviews,unresolved:[]});
}
const replacements=new Map(sets.map(s=>[s.id,s]));
const preview=bank.flatMap(s=>{
  if(!replacements.has(s.id))return [s];
  const standard=cloneStandard(s);
  return standard?[replacements.get(s.id),standard]:[replacements.get(s.id)];
});
function cloneStandard(s){const qs=s.subquestions.filter(q=>catalog.classifications.find(c=>c.source_set_id===s.id&&c.subquestion_id===q.id)?.question_style==='standard');if(!qs.length)return null;const out=structuredClone(s);out.id=`preview-c-standards-${s.id}`;out.status='needs_review';out.verification.review_status='needs_human_review';out.shared_context.facts=[];out.subquestions=structuredClone(qs);for(const q of out.subquestions){const c=catalog.classifications.find(c=>c.source_set_id===s.id&&c.subquestion_id===q.id);q.question_style='standard';q.topic_ids=c.topic_ids;q.prompt=c.standalone_prompt;}out.learning_order=out.subquestions.map(q=>q.id);return out;}
const validation=validateAuthoringBank(preview);
const errors=validation.errors;
fs.writeFileSync(`${D}/c/design.json`, JSON.stringify(designs,null,2)+'\n');
fs.writeFileSync(`${D}/c/review.json`, JSON.stringify({version:1,sets:reviews,unresolved:[],validation},null,2)+'\n');
fs.writeFileSync(`${D}/c/qa.json`, JSON.stringify(qa,null,2)+'\n');
console.log(JSON.stringify({sets:sets.length,questions:reviews.flatMap(s=>s.questions).length,qa:qa.length,errors},null,2));
if(errors.length)process.exitCode=1;
