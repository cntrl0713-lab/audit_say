// 기준서형 추가 후보 조사(2026-09-14)의 근거 장부 생성기.
//   node cpa_uploader/analysis/reviews/standard-question-gaps-2026-09-14/build-evidence.mjs          # evidence.json 작성
//   node cpa_uploader/analysis/reviews/standard-question-gaps-2026-09-14/build-evidence.mjs --check  # 쓰지 않고 현재 입력과 대조
// 후보·관계·판단은 아래 CANDIDATES의 수동 입력이다. 빈도·원출제·연도는 question-elements.json에서 읽고,
// 인접 물음 키와 원문 앵커의 실존을 검사한다. 모델 호출이나 문항 생성은 하지 않는다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const here = 'cpa_uploader/analysis/reviews/standard-question-gaps-2026-09-14';
const out = path.join(here, 'evidence.json');

const INPUTS = {
  bank: 'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
  classifications: 'cpa_uploader/data/learning-question-classifications.json',
  elements: 'cpa_uploader/analysis/question-elements/question-elements.json',
  registry: 'cpa_uploader/analysis/coverage/registry.json',
};
const SOURCES = {
  ETH: 'cpa_uploader/raw/materials/verification/1303e54860a58770/ethics-2024-complete.txt',
  ED: 'cpa_uploader/raw/materials/verification/a8808cfc8f2663a6/ethics-2026-ed-overview.txt',
  LAW: 'cpa_uploader/raw/materials/verification/dd662b5464e1e9d5/external-audit-law-text.txt',
  KGA: 'cpa_uploader/raw/materials/verification/f0914795b909ea38/kga-2026-pymupdf-pages.txt',
};
const UNPUBLISHED_BATCHES = ['standard-gap-2026-09-13', 'standard-expansion-2026-09-13', 'standard-followup-2026-09-13'];

// relation: direct | partial | adjacent (coverage README의 관계 어휘). adjacent는 빈도 합계에 넣지 않는다.
const CANDIDATES = [
  {
    id: 'E1', priority: 'P1', edition_gate: true, topics: ['01'],
    area: '윤리강령 다섯 가지와 윤리 위협의 다섯 유형',
    units: [
      { id: 'E1-1', requirement: '윤리강령 다섯 가지의 명칭과 의미', answer_type: 'enumeration', paragraphs: '윤리기준 100.4' },
      { id: 'E1-2', requirement: '위협의 다섯 유형과 발생 상황, 안전장치로도 수용가능한 수준이하로 줄일 수 없을 때의 조치', answer_type: 'descriptive', paragraphs: '윤리기준 100.7, 100.10' },
    ],
    elements: [
      ['0d8889d078f0eb9d', 'direct'], ['370f4321222c10ac', 'direct'], ['3a427a724e81fe7c', 'direct'],
      ['cb5b59ee3283c9bb', 'partial'], ['ffcfbb078f45e2ad', 'partial'], ['717aa83d34c14f44', 'direct'],
      ['4edcec94c4b33d77', 'adjacent'], ['e194fd1c8239e7ec', 'adjacent'], ['8cf757b8c2981532', 'adjacent'],
    ],
    neighbors: ['pilot-01-005/sub3', 'draft-standard-additional-20260913-e01/sub1', 'draft-standard-followup-20260913-e01/sub1'],
    gap: '은행·초안은 낮은 보수·선물·성공보수 등 특정 상황에서 발생하는 위협 하나를 묻는다. 윤리강령 전체와 위협 유형 체계를 독립적으로 묻는 물음은 없다.',
    anchors: [
      ['ETH', '100.4 공인회계사는 다음과 같은 윤리강령을 준수하여야 한다.'],
      ['ETH', '100.7 공인회계사는 위협의 심각성을 검토함에 있어서'],
      ['ETH', '100.10 윤리강령의 준수에 지장을 초래할 수 있는 잠재적인 위협들은'],
    ],
  },
  {
    id: 'E2', priority: 'P1', edition_gate: true, topics: ['01'],
    area: '안전장치의 분류와 업무환경 안전장치의 세 수준',
    units: [
      { id: 'E2-1', requirement: '안전장치의 두 분류와 한국공인회계사회·법규에 의한 안전장치', answer_type: 'enumeration', paragraphs: '윤리기준 100.11–100.12' },
      { id: 'E2-2', requirement: '제시한 품질관리 활동을 회계법인 전체·개별업무·의뢰인 조직 수준으로 분류(목록 전체 암기 대신 분류형 설계)', answer_type: 'judgment', paragraphs: '윤리기준 200.12–200.15' },
    ],
    elements: [
      ['aa4a326b755ec710', 'direct'], ['0d46bdef08a62a69', 'direct'], ['6287678bb860a856', 'direct'],
      ['e5de75a8196d1a62', 'direct'], ['6e14633e37e256b1', 'direct'], ['83b140b209437ca1', 'direct'], ['ff61dac9f9e60958', 'direct'],
    ],
    neighbors: ['pilot-01-005/sub3'],
    gap: '은행·초안에 안전장치의 분류 체계를 묻는 물음이 없다. 200.12의 예시가 15개이므로 모두 열거하게 하지 말고 제시 활동의 수준별 분류로 설계한다.',
    anchors: [
      ['ETH', '100.11 이러한 위협을 제거하거나 수용가능한 수준이하로 감소시키기 위한 안전장치는'],
      ['ETH', '100.12 한국공인회계사회의 회칙이나 내규 또는 법규에 의하여 마련된 안전장치는'],
      ['ETH', '200.12 업무환경내의 안전장치 중 회계법인 전체에 대한 안전장치를'],
      ['ETH', '200.13 업무환경내의 안전장치 중 개별업무에 대한 안전장치를'],
      ['ETH', '200.15 의뢰인 조직 및 절차내에 마련된 안전장치를'],
    ],
  },
  {
    id: 'E3', priority: 'P1', edition_gate: true, topics: ['01'],
    area: '인증의뢰인 보수: 상대적 크기·연체보수·성공보수',
    units: [
      { id: 'E3-1', requirement: '회계법인·파트너 보수에서 차지하는 비중과 연체보수의 위협, 심각성 요인, 안전장치', answer_type: 'descriptive', paragraphs: '윤리기준 290.206–290.208' },
      { id: 'E3-2', requirement: '인증업무 성공보수 금지와 이유, 인증의뢰인 비인증업무 성공보수의 금지 조건·심각성 요인·안전장치', answer_type: 'descriptive', paragraphs: '윤리기준 290.210–290.212' },
    ],
    elements: [
      ['4c08b5f9d2223c6d', 'direct'], ['5de55353c3df1fe4', 'partial'], ['ba1282b522d516d6', 'partial'], ['9808a14231e8c354', 'partial'],
      ['ab19b01c317db844', 'direct'], ['77f6bd1c21e50686', 'direct'], ['e194fd1c8239e7ec', 'partial'], ['8086c879c55ba142', 'adjacent'],
    ],
    neighbors: ['pilot-01-005/sub3', 'draft-standard-followup-20260913-e01/sub1', 'draft-standard-followup-20260913-e01/sub2'],
    gap: '은행은 전임감사인보다 낮은 보수(290.209 계열), 미게시 초안은 일반 비인증업무 성공보수(240.3–240.4)를 다룬다. 인증의뢰인에 대한 보수 의존도·연체보수와 290.211–290.212의 금지·요인은 없다.',
    anchors: [
      ['ETH', '290.206 특정 인증의뢰인에 대한 보수총액이'],
      ['ETH', '290.208 전문서비스를 제공한 대가로 인증의뢰인에게 청구한 보수의 상당액이'],
      ['ETH', '290.211 회계법인이 인증업무와 관련하여 성공보수를 지급 받기로 하는 경우'],
      ['ETH', '290.212 회계법인이 인증의뢰인에게 제공하는 비인증업무와 관련하여 성공보수를 지급'],
    ],
  },
  {
    id: 'E4', priority: 'P1', edition_gate: true, topics: ['01'],
    area: '인증의뢰인과의 고용관계',
    units: [
      { id: 'E4-1', requirement: '전·현 구성원이나 파트너가 인증의뢰인에 고용된 경우 위협, 심각성 요인, 필수 조건', answer_type: 'descriptive', paragraphs: '윤리기준 290.143–290.144' },
      { id: 'E4-2', requirement: '장래 고용될 구성원에 대한 필수 안전장치와 추가 고려, 의뢰인 임직원이었던 자가 팀원이 된 경우의 위협', answer_type: 'descriptive', paragraphs: '윤리기준 290.145–290.146' },
    ],
    elements: [
      ['38c405d5f9e5c799', 'direct'], ['02793e1d513e737e', 'partial'], ['ccd865e492671521', 'partial'], ['dc1c24547f232ba2', 'partial'],
      ['debd754917798cbb', 'adjacent'],
    ],
    neighbors: [],
    gap: '고용관계에 관한 물음이 은행·초안에 없다. 2022년의 이직 후 재수임 판단은 법규상 결격 기간과 관련될 수 있어 인접 관계로만 둔다.',
    anchors: [
      ['ETH', '290.143 과거에 인증업무팀의 구성원 또는 회계법인의 파트너이었던 자가 현재에는'],
      ['ETH', '290.145 인증업무에 참여하고 있는 인증업무팀의 구성원이 장래의 특정 시점에'],
      ['ETH', '290.146 인증의뢰인의 임직원이었던 자가 인증업무팀의 구성원으로서 업무를 수행하게 된'],
    ],
  },
  {
    id: 'E5', priority: 'P1', edition_gate: true, topics: ['01'],
    area: '알선수수료와 광고',
    units: [
      { id: 'E5-1', requirement: '알선수수료 수령·지급의 위협, 전면 금지와 이유, 회계법인 인수대가의 취급', answer_type: 'descriptive', paragraphs: '윤리기준 240.5–240.8' },
      { id: 'E5-2', requirement: '광고로 발생하는 위협과 금지되는 두 행위, 적절성 의문 시 조치', answer_type: 'descriptive', paragraphs: '윤리기준 250.1–250.2' },
    ],
    elements: [['9ca06407b08ff120', 'direct'], ['2f5b26833f075218', 'direct'], ['e19289b1e4d3aca4', 'direct'], ['cb5b59ee3283c9bb', 'partial']],
    neighbors: [],
    gap: '은행·초안에 없다. 공개초안은 알선수수료를 소개수수료로 바꾸고 감사·인증 외 업무에는 안전장치를 허용하므로 판본 결정의 영향이 가장 크다.',
    anchors: [
      ['ETH', '240.5 개업공인회계사는 의뢰인과의 업무와 관련하여 알선수수료를 수령할 수 있는 상황에'],
      ['ETH', '240.8 개업공인회계사가 다른 회계법인 업무의 전부 또는 일부를 인수하는 경우'],
      ['ETH', '250.1 개업공인회계사가 광고 또는 기타 마케팅방식을 이용하여'],
      ['ETH', '250.2 개업공인회계사는 전문서비스를 광고하는 경우'],
      ['ED', '25. 알선수수료(Referral Fees or Commissions ) 관련 규정 개정'],
    ],
  },
  {
    id: 'L1', priority: 'P1', edition_gate: false, topics: ['03'],
    area: '외부감사법상 감사인 선임기한과 선정주체',
    units: [
      { id: 'L1-1', requirement: '일반 회사·감사위원회 의무설치 회사·직전 연도 미감사 회사의 선임기한과 선임 특례 사유 발생 시 기한', answer_type: 'enumeration', paragraphs: '외부감사법 제10조제1항·제2항·제7항·제8항' },
      { id: 'L1-2', requirement: '주권상장법인·대형비상장주식회사·금융회사와 그 밖의 회사의 감사인 선정주체', answer_type: 'enumeration', paragraphs: '외부감사법 제10조제4항' },
    ],
    elements: [
      ['47de5773f6ac8e42', 'direct'], ['7622b7a72bd33bed', 'direct'], ['9e7c67bc03519fc9', 'direct'], ['7821f1040a81e7d1', 'direct'],
      ['fd8194037807040a', 'direct'], ['05ed2f54bdab5186', 'direct'],
    ],
    neighbors: ['draft-standard-expansion-20260913-l01/sub1', 'draft-standard-expansion-20260913-l01/sub2'],
    gap: '미게시 초안은 제9조 교체의무만 다룬다. 선임기한·선정주체를 묻는 물음은 없다. 대형비상장주식회사·일정규모 유한회사의 금액 기준은 시행령 원문을 확보해야 한다.',
    anchors: [['LAW', '제10조(감사인의 선임)']],
  },
  {
    id: 'L2', priority: 'P1', edition_gate: false, topics: ['01'],
    area: '외부감사법상 감사인의 손해배상책임',
    units: [
      { id: 'L2-1', requirement: '회사·제3자에 대한 책임 발생 요건, 감사반의 연대, 이사·감사와의 연대와 비례책임, 입증책임과 그 전환 대상', answer_type: 'descriptive', paragraphs: '외부감사법 제31조제1항–제4항·제7항' },
      { id: 'L2-2', requirement: '청구권 소멸기간과 계약상 연장, 손해배상공동기금의 적립', answer_type: 'descriptive', paragraphs: '외부감사법 제31조제8항·제9항, 제32조제1항' },
    ],
    elements: [
      ['3b7b18a94d352fd9', 'direct'], ['dcb28d05a0fb78e6', 'direct'], ['794e1b674f05b63a', 'direct'], ['da6b55d682477a4e', 'partial'],
      ['db2ee56addd212eb', 'partial'], ['05d21a6d8390b21d', 'partial'], ['ffa5ade74a6f2f36', 'partial'],
    ],
    neighbors: [],
    gap: '손해배상책임 물음이 은행·초안에 없다. 손해배상준비금 비교는 공인회계사법, 민법·자본시장법 비교는 이번 원문 밖이므로 제외하거나 원문을 추가 확보한다.',
    anchors: [['LAW', '제31조(손해배상책임)'], ['LAW', '제32조(손해배상공동기금의 적립 등)']],
  },
  {
    id: 'S1', priority: 'P1', edition_gate: false, topics: ['15'],
    area: '수임 후 경영진의 감사범위 제한',
    units: [
      { id: 'S1-1', requirement: '수임 후 경영진의 제한을 알게 된 경우의 제거 요청, 지배기구 커뮤니케이션·대체절차, 증거 미입수 시 한정·해지·의견거절', answer_type: 'descriptive', paragraphs: 'KGA 705.11–13' },
      { id: 'S1-2', requirement: '충분하고 적합한 감사증거를 입수할 수 없는 상황의 세 원천과 경영진 제한의 추가 시사점', answer_type: 'descriptive', paragraphs: 'KGA 705.A8–A12' },
    ],
    elements: [
      ['48532e6be05c1b44', 'direct'], ['41aa232a99c00949', 'direct'], ['1f5e9e81044d8f8e', 'direct'], ['f7b9de0504a49bb1', 'direct'],
      ['5a13329569147315', 'direct'],
    ],
    neighbors: ['pilot-15-003/sub1', 'pilot-03-002/sub1', 'pilot-14-004/sub1', 'pilot-13-008/sub1'],
    gap: '은행은 의견 조합(705.7–9), 수임 전 범위제한(210.7), 그룹 수임 단계를 다룬다. 수임 후 경영진 제한의 절차(705.11–13)와 원천별 예시는 없다.',
    anchors: [
      ['KGA', '당 제한을 제거하도록 요청하여야 한다.'],
      ['KGA', '기업의 통제를 벗어난 상황'],
      ['KGA', 'A12. 경영진에 의한 감사범위의 제한으로 인하여'],
    ],
  },
  {
    id: 'S2', priority: 'P1', edition_gate: false, topics: ['05'],
    area: '지배기구 커뮤니케이션의 책임·계획 범위와 절차',
    units: [
      { id: 'S2-1', requirement: '감사인의 책임 및 계획된 감사범위와 시기의 커뮤니케이션', answer_type: 'enumeration', paragraphs: 'KGA 260.14–15' },
      { id: 'S2-2', requirement: '커뮤니케이션의 형태·시기·예상 내용의 사전 커뮤니케이션, 서면 요구, 적시성, 문서화', answer_type: 'descriptive', paragraphs: 'KGA 260.18–21, 23' },
    ],
    elements: [['c5c0040a2c05d070', 'direct'], ['f80f4843a8e4f38f', 'partial'], ['46f765c4b70d766d', 'direct'], ['b1e3165b217ad2dc', 'direct']],
    neighbors: ['pilot-05-008/sub1', 'pilot-05-008/sub2', 'pilot-05-003/sub1', 'draft-standard-gap-20260913-g01/sub1', 'draft-standard-expansion-20260913-s04/sub1'],
    gap: '260.16·17(은행), 효익(초안 G01), 22(초안)는 있다. 14·15의 전달 사항과 18–21·23의 절차는 빠져 있다. 265의 미비점 서면 커뮤니케이션과 구별한다.',
    anchors: [
      ['KGA', '감사인은 다음과 같은 사항 등 재무제표감사와 관련된 감사인의 책임에 대하여 지배기구와'],
      ['KGA', '감사인은 계획된 감사범위와 시기의 개요에 대하여 지배기구와 커뮤니케이션하여야 하며,'],
      ['KGA', '감사인은 커뮤니케이션의 형태, 시기 및 예상되는 일반적 내용에 대하여 지배기구와 커뮤'],
      ['KGA', '감사인은 적시에 지배기구와 커뮤니케이션하여야 한다. (문단 A49-A50 참조)'],
    ],
  },
  {
    id: 'S4', priority: 'P1', edition_gate: false, topics: ['14'],
    area: '그룹업무팀과 부문감사인의 상호 커뮤니케이션',
    units: [
      { id: 'S4-1', requirement: '그룹업무팀이 부문감사인에게 전달할 협조 확인 요청·윤리적 요구사항·특수관계자 목록', answer_type: 'enumeration', paragraphs: 'KGA 600.40(a)(b)(e)' },
      { id: 'S4-2', requirement: '부문감사인에게 커뮤니케이션을 요청할 사항', answer_type: 'enumeration', paragraphs: 'KGA 600.41(a)–(j)' },
    ],
    elements: [['721ef1cf0cbca346', 'direct'], ['22a8c686ef7913d3', 'direct'], ['2d1d3050048a120f', 'direct'], ['c17a7201d38ef9ab', 'direct']],
    neighbors: ['pilot-14-002/sub2', 'pilot-14-003/sub2', 'pilot-14-004/sub2'],
    gap: '은행은 600.40의 업무·중요성·유의적 위험·보고 형식과 부문감사인 커뮤니케이션의 평가(42)를 다룬다. 40(a)(b)(e)와 41의 보고 항목은 없다.',
    anchors: [
      ['KGA', '그룹업무팀은 부문감사인에게 요구사항을 적시에 커뮤니케이션하여야 한다.'],
      ['KGA', '그룹업무팀은 그룹감사에 대한 그룹업무팀의 결론과 관련성이 있는 사항을 커뮤니케이션하'],
    ],
  },
  {
    id: 'S3', priority: 'P2', edition_gate: false, topics: ['12', '05'],
    area: '계속기업 관련 지배기구 커뮤니케이션',
    units: [{ id: 'S3-1', requirement: '존속능력에 유의적 의문을 초래하는 사건·상황에 관해 지배기구와 커뮤니케이션할 네 사항과 적용 조건', answer_type: 'enumeration', paragraphs: 'KGA 570.25' }],
    elements: [['ad4bd0f986647a8c', 'direct']],
    neighbors: ['pilot-12-003/sub1', 'draft-standard-gap-20260913-g03/sub1', 'draft-12-570-freq01/q1'],
    gap: '570의 추가절차·보고는 있으나 지배기구 커뮤니케이션 항목은 없다.',
    anchors: [['KGA', '지배기구의 모든 구성원이 그 기업의 경영에 참여하고 있지 않는 한,6 감사인은 계속기업으']],
  },
  {
    id: 'E6', priority: 'P2', edition_gate: true, topics: ['01'],
    area: '업무수임기간과 수임 전 제공한 비인증업무',
    units: [{ id: 'E6-1', requirement: '독립성 유지기간의 시작·종료(반복 업무 포함)와 수임 전 비인증업무의 위협 판단·안전장치', answer_type: 'descriptive', paragraphs: '윤리기준 290.31–290.33' }],
    elements: [['512fe141196109fc', 'direct'], ['207f5f835a8f877e', 'direct'], ['53bed12ca925f1a7', 'direct']],
    neighbors: [],
    gap: '은행·초안에 없다.',
    anchors: [
      ['ETH', '290.31 인증업무팀의 구성원과 회계법인은 인증업무수임기간동안 인증의뢰인에 대한'],
      ['ETH', '290.33 감사대상 재무제표의 회계기간중 또는 그 이후에 재무제표감사업무를 착수한'],
    ],
  },
  {
    id: 'L3', priority: 'P2', edition_gate: false, topics: ['03'],
    area: '연속 3개 사업연도 동일 감사인, 감사인 해임, 감사인의 감사계약 해지',
    units: [{ id: 'L3-1', requirement: '동일 감사인 선임 의무와 해임·계약해지의 법정 절차(사유는 시행령 확보 후)', answer_type: 'descriptive', paragraphs: '외부감사법 제10조제3항, 제13조, 제15조와 시행령' }],
    elements: [['acbc2253fbcd427e', 'partial'], ['f90d101509f7230e', 'direct'], ['dc4ce4870332a4f3', 'partial'], ['c94de307d230244c', 'adjacent']],
    neighbors: [],
    gap: '없다. 해임·해지 사유가 시행령에 있어 원문 추가 확보가 필요하다.',
    anchors: [['LAW', '제13조(감사인의 해임)'], ['LAW', '제15조(감사인의 감사계약 해지)']],
  },
  {
    id: 'L4', priority: 'P2', edition_gate: false, topics: ['01', '03'],
    area: '재무제표 작성 책임과 감사인의 금지행위',
    units: [{ id: 'L4-1', requirement: '재무제표 작성 책임자와 감사인·소속 공인회계사의 대리작성·자문 금지(세부 행위는 시행령 확보 후)', answer_type: 'descriptive', paragraphs: '외부감사법 제6조제1항·제6항과 시행령' }],
    elements: [['af00a44993cf3cd8', 'direct']],
    neighbors: ['pilot-03-001/sub1'],
    gap: '감사 전제조건의 경영진 책임은 있으나 법상 작성 책임과 감사인 금지행위는 없다.',
    anchors: [['LAW', '제6조(재무제표의 작성 책임 및 제출)']],
  },
  {
    id: 'L5', priority: 'P2', edition_gate: false, topics: ['01'],
    area: '공인회계사법상 감사대상회사에 대한 금지 비감사업무',
    units: [{ id: 'L5-1', requirement: '감사기간 중 제공이 금지되는 비감사업무(시행령 포함)', answer_type: 'enumeration', paragraphs: '공인회계사법 제21조와 시행령 — 원문 미확보' }],
    elements: [['d8d8a8f1c3de0179', 'direct']],
    neighbors: ['pilot-19-004/sub1'],
    gap: '없다. 공인회계사법 제21조 원문을 raw에 먼저 수집해야 한다.',
    anchors: [],
  },
  {
    id: 'S5', priority: 'P2', edition_gate: false, topics: ['05'],
    area: '부정 왜곡표시의 발견 곤란성, 업무팀 토의, 부정 관련 서면진술',
    units: [
      { id: 'S5-1', requirement: '부정으로 인한 왜곡표시가 오류보다 발견하기 어려운 이유', answer_type: 'descriptive', paragraphs: 'KGA 240.6' },
      { id: 'S5-2', requirement: '부정위험에 관한 업무팀 토의에서 강조할 사항과 토의의 효과', answer_type: 'descriptive', paragraphs: 'KGA 240.16, A11–A12' },
      { id: 'S5-3', requirement: '부정과 관련하여 입수할 경영진 서면진술', answer_type: 'enumeration', paragraphs: 'KGA 240.40' },
    ],
    elements: [['e1bae424ee7d27e8', 'direct'], ['9eaab7eb1a9ad49e', 'direct'], ['fdf644fdbd189379', 'direct']],
    neighbors: ['pilot-05-009/sub2', 'pilot-06-002/sub2'],
    gap: '경영진·종업원 부정 비교(240.7)와 315 토의 주제는 있으나 세 요구는 없다.',
    anchors: [
      ['KGA', '로 인한 경우보다 크다. 이는 부정의 경우 그 사실을 은폐하기 위해 위조, 거래의 기록에'],
      ['KGA', 'A11. 기업의 재무제표가 부정으로 인하여 중요하게 왜곡표시 될 위험성에 대한 업무팀의 토의는'],
      ['KGA', '감사인은 다음 사항에 대하여 경영진(적절한 경우 지배기구를 포함)의 서면진술을 입수하여'],
    ],
  },
  {
    id: 'S6', priority: 'P2', edition_gate: false, topics: ['02', '06'],
    area: '중요왜곡표시위험의 구성, 고유위험요소, 내부통제시스템의 구성요소',
    units: [
      { id: 'S6-1', requirement: '경영진주장 수준 중요왜곡표시위험의 두 구성요소(고유위험·통제위험) 정의', answer_type: 'descriptive', paragraphs: 'KGA 200.A40–A43' },
      { id: 'S6-2', requirement: '고유위험요소의 정의와 종류', answer_type: 'enumeration', paragraphs: 'KGA 315.12(f)' },
      { id: 'S6-3', requirement: '내부통제시스템 다섯 구성요소의 명칭', answer_type: 'enumeration', paragraphs: 'KGA 315 정의·A90–A95' },
    ],
    elements: [
      ['d519200462faf9e4', 'direct'], ['1943e90e48630440', 'partial'],
      ['3a861de829e0912f', 'partial'], ['ca19df21e6aa6e30', 'partial'], ['d0271f7d125b393e', 'partial'], ['f42bee9a15067017', 'partial'],
    ],
    neighbors: ['pilot-02-005/sub1', 'pilot-06-005/sub1', 'pilot-11-001/sub1', 'pilot-06-001/sub1', 'draft-standard-expansion-20260913-s06/sub1'],
    gap: '감사위험·적발위험 정의, 540 추정치의 고유위험요소, 통제환경은 있다. 고유·통제위험 정의, 315의 고유위험요소 전체, 다섯 구성요소는 없다.',
    anchors: [
      ['KGA', 'A41. 고유위험은 고유위험요소에 영향을 받는다.'],
      ['KGA', 'A43. 통제위험은 재무제표 작성과 관련된 기업의 목적달성에 위협이 되는 것으로'],
      ['KGA', '고유위험요소 – 통제를 고려하기 전에 부정 또는 오류로 인하여 거래유형, 계정잔액'],
      ['KGA', '내부통제시스템은 서로 연관된 다섯 가지 구성요소로 이루어진다.'],
    ],
  },
  {
    id: 'S7', priority: 'P2', edition_gate: false, topics: ['10'],
    area: '비표본위험',
    units: [{ id: 'S7-1', requirement: '비표본위험의 정의와 원인(부적합한 절차, 증거의 오해석, 왜곡표시·이탈의 미인식)', answer_type: 'descriptive', paragraphs: 'KGA 530.5(d), A1' }],
    elements: [['a5f8b47a4208d641', 'direct']],
    neighbors: ['pilot-10-004/sub1', 'pilot-10-006/sub1'],
    gap: '표본위험만 있다.',
    anchors: [['KGA', '비표본위험- 감사인이 표본위험과 관련이 없는 다른 이유에 의해 잘못된 결론에 도']],
  },
  {
    id: 'S8', priority: 'P2', edition_gate: false, topics: ['12', '15'],
    area: '재무제표 승인일·감사보고서일·재무제표 발행일',
    units: [{ id: 'S8-1', requirement: '세 일자의 정의와 구별', answer_type: 'descriptive', paragraphs: 'KGA 560.5' }],
    elements: [['b2f3c0a90ae3028a', 'direct'], ['4c761478cdb68494', 'direct'], ['b4d316c68fe41601', 'direct'], ['02cd10a59201c490', 'adjacent']],
    neighbors: ['pilot-12-007/sub2', 'pilot-15-007/sub1'],
    gap: '새 보고서일 제한과 사례형 날짜 판단은 있으나 정의 물음은 없다.',
    anchors: [
      ['KGA', '재무제표 승인일- 재무제표(관련 주석 포함)를 구성하는 모든 내용의 작성이 완료되'],
      ['KGA', '재무제표 발행일- 감사보고서와 감사받은 재무제표를 제3자들이 이용할 수 있게 된'],
    ],
  },
  {
    id: 'S9', priority: 'P2', edition_gate: false, topics: ['11'],
    area: '특수관계자 거래의 높은 위험과 발견의 어려움',
    units: [{ id: 'S9-1', requirement: '특수관계자 거래가 더 높은 중요왜곡표시위험을 초래할 수 있는 상황과 고유한계가 더 큰 이유', answer_type: 'descriptive', paragraphs: 'KGA 550.2, 550.6' }],
    elements: [['f005a3a355834626', 'direct'], ['dc6773c176bb9517', 'direct']],
    neighbors: ['pilot-11-001/sub2', 'pilot-11-006/sub1'],
    gap: '절차 요구는 많으나 위험의 특성 자체를 묻는 물음은 없다.',
    anchors: [
      ['KGA', '특수관계자들은 그 성격상 광범위하고 복잡한 관계 및 구조를 통해 사업을 수행하고'],
      ['KGA', '같은 이유 때문에, 특수관계자의 경우에는 고유한계가 감사인의 중요한 왜곡표시를 발견하'],
    ],
  },
  {
    id: 'S10', priority: 'P2', edition_gate: false, topics: ['11'],
    area: '이전 회계추정치 결과의 검토',
    units: [{ id: 'S10-1', requirement: '위험 식별·평가를 위한 이전 회계추정치 결과·재추정 검토의 목적과 성격·범위 결정, 사후적 판단 목적이 아님', answer_type: 'descriptive', paragraphs: 'KGA 540.14, A55–A57' }],
    elements: [['b47e6e96e0f1b801', 'partial'], ['36d6a322ce97bbda', 'partial']],
    neighbors: ['pilot-05-006/sub1', 'pilot-05-002/sub2'],
    gap: '은행의 소급 재검토는 240의 경영진 편의 대응이다. 540.14의 위험평가 목적 검토와 구별해야 하며 중복 위험이 있다.',
    anchors: [['KGA', '감사인은 당기의 중요왜곡표시위험을 식별하고 평가하는 데 도움을 주기 위하여 이전 회계']],
  },
  {
    id: 'S11', priority: 'P2', edition_gate: false, topics: ['08'],
    area: '감사증거로서 질문의 성격과 증거의 양',
    units: [
      { id: 'S11-1', requirement: '질문의 의미·형태·답변 평가와 질문만으로는 충분하지 않은 이유', answer_type: 'descriptive', paragraphs: 'KGA 500.A2, A26–A29' },
      { id: 'S11-2', requirement: '필요한 감사증거의 양에 영향을 미치는 요인', answer_type: 'descriptive', paragraphs: 'KGA 500.5(e), A4' },
    ],
    elements: [
      ['4c6cce93d87d37cf', 'direct'], ['32560bf4444e01a5', 'direct'], ['ef08577f06a108a5', 'direct'],
      ['f2cb15aee3bebdcb', 'partial'], ['f6df522a6847e9e7', 'partial'], ['934f639345b4b41f', 'adjacent'],
    ],
    neighbors: ['pilot-02-004/sub1', 'pilot-08-003/sub2'],
    gap: '충분성·적합성의 척도와 관찰의 한계는 있으나 질문과 증거량 요인은 없다.',
    anchors: [
      ['KGA', 'A26. 질문은 기업의 내부 또는 외부의 재무나 비재무 분야의 관련 지식이 있는 자로부터 정보를'],
      ['KGA', '(감사증거의) 충분성 – 감사증거의 양적 척도. 필요한 감사증거의 양은 감사인의 중'],
    ],
  },
];

const DEFERRED = [
  { area: '중요성 개념이 적용되는 감사 단계', elements: ['ebb07c884de71529'], reason: '1회 출제이며 320의 기존 물음과 연결이 약함. 필요 시 P3.' },
  { area: '감사문서 작성의 목적', elements: ['documentation.main-purpose'], reason: '1회 출제. 230의 기존 5개 물음 뒤에 둘 보완 후보.' },
  { area: '회계추정치 관련 위험평가 이해사항(540.13)', elements: ['99b6ae7c05f19ffc'], reason: '목록이 매우 길어 분할 설계가 먼저 필요.' },
  { area: '외부감사법상 감사인 지정 사유', elements: ['fc252858ae816fd4'], reason: '대부분 시행령 위임이며 원문 미확보.' },
  { area: '내부회계관리제도 운영·감사 대상', elements: ['a27f0a7023c94f05', '9d677c19cd2b9b55', 'cfb0aae2a1384353', 'c17e11e0280676f1', 'bcb0e88b90019d7e'], reason: '부칙의 연도별 적용례에 따라 답이 달라져 판단 시점 확정이 먼저 필요.' },
  { area: '독립성 위반의 계약체결기한 전후 대응', elements: ['45390e76bbcbcfb2', '52101ee5aa8ad12e'], reason: '보관 윤리기준에서 대응 문단을 찾지 못함. 원출처 확인 전 제외.' },
];

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function build() {
  const errors = [];
  const bank = readJson(INPUTS.bank);
  const cls = readJson(INPUTS.classifications).classifications;
  const els = readJson(INPUTS.elements).elements;
  const keys = new Set();
  for (const set of bank) for (const q of set.subquestions) keys.add(`${set.id}/${q.id}`);
  const draftKeys = new Map();
  let draftPoints = 0;
  for (const batch of UNPUBLISHED_BATCHES) {
    const dir = path.join('cpa_uploader/drafts', batch);
    for (const file of fs.readdirSync(path.join(root, dir)).filter((f) => /^[a-z]\d\d\.json$/.test(f)).sort()) {
      const set = readJson(path.join(dir, file));
      for (const q of set.subquestions) {
        draftKeys.set(`${set.id}/${q.id}`, `${dir}/${file}`);
        draftPoints += q.criteria.reduce((sum, c) => sum + c.max_points, 0);
      }
    }
  }
  const lines = Object.fromEntries(Object.entries(SOURCES).map(([k, f]) => [k, fs.readFileSync(path.join(root, f), 'utf8').split(/\r?\n/)]));
  const findElement = (suffix) => {
    const hits = els.filter((e) => e.id === suffix || e.id.endsWith(suffix));
    if (hits.length !== 1) errors.push(`element ${suffix}: ${hits.length}개 일치`);
    return hits[0];
  };
  const candidates = CANDIDATES.map((c) => {
    const elements = c.elements.map(([suffix, relation]) => {
      const e = findElement(suffix);
      return e ? { id: e.id, relation, label: e.label, topic_id: e.topic_id, exam_questions: e.exam_questions, exam_frequency: e.exam_frequency, mock_frequency: e.mock_frequency } : { id: suffix, relation, missing: true };
    });
    const counted = elements.filter((e) => e.relation !== 'adjacent' && !e.missing);
    const examQuestions = [...new Set(counted.flatMap((e) => e.exam_questions))].sort();
    const neighbors = c.neighbors.map((key) => {
      const scope = keys.has(key) ? 'bank' : draftKeys.has(key) ? 'unpublished_draft' : null;
      if (!scope) errors.push(`${c.id}: 인접 물음 ${key} 없음`);
      return { key, scope, file: draftKeys.get(key) ?? null };
    });
    const anchors = c.anchors.map(([src, text]) => {
      const found = lines[src].flatMap((line, i) => (line.includes(text) ? [i + 1] : []));
      if (found.length === 0) errors.push(`${c.id}: 원문 앵커 없음 (${src}) ${text}`);
      return { file: SOURCES[src], line: found[0] ?? null, matches: found.length, text };
    });
    return {
      id: c.id, priority: c.priority, edition_gate: c.edition_gate, area: c.area, topics: c.topics, units: c.units,
      direct_or_partial_exam_questions: examQuestions,
      exam_years: [...new Set(examQuestions.map((q) => q.split(':')[1]))].sort(),
      elements, neighbors, gap: c.gap, source_anchors: anchors,
    };
  });
  const deferred = DEFERRED.map((d) => ({ ...d, elements: d.elements.map((s) => findElement(s)?.id ?? s) }));
  const styles = cls.reduce((acc, x) => ({ ...acc, [x.question_style]: (acc[x.question_style] ?? 0) + 1 }), {});
  const evidence = {
    version: 1,
    review_date: '2026-09-14',
    scope: '후보 탐색과 기존 요구 차이의 agent 대조. 신규 발문·모범답안·배점 확정, 모델 API 검수·실제 채점, 정본·DB 변경은 미수행.',
    inputs: [...Object.values(INPUTS), ...Object.values(SOURCES)].map((file) => ({ file, sha256: sha(file) })),
    counts: {
      sets: bank.length, questions: keys.size, standard: styles.standard ?? 0, case: styles.case ?? 0,
      unpublished_standard_draft_questions: draftKeys.size, unpublished_standard_draft_points: draftPoints,
      candidate_areas: candidates.length, candidate_units: candidates.reduce((sum, c) => sum + c.units.length, 0),
      p1_units: candidates.filter((c) => c.priority === 'P1').reduce((sum, c) => sum + c.units.length, 0),
    },
    validation: {
      classification_complete: cls.length === keys.size && cls.every((x) => keys.has(`${x.source_set_id}/${x.subquestion_id}`)),
      errors,
    },
    unpublished_drafts: {
      batches: UNPUBLISHED_BATCHES.map((b) => `cpa_uploader/drafts/${b}`),
      against_bank_check: 'npx tsx cpa_uploader/validate_draft_v3.ts --file <각 개별 초안> --against-bank — 2026-09-14 27개 파일 모두 통과(형상·인용 실존·ID/발문 충돌 없음). 의미 중복 검사는 아님.',
    },
    edition_notes: {
      ethics: '후보 근거는 2024-12-19 의결 윤리기준 전문. 2026-09-02 공개초안은 국제윤리기준 체계로 전면 개편하고 원칙적으로 2027-01-01 시행을 제안하며 공정→객관성, 알선수수료→소개수수료(감사·인증 외 업무는 안전장치 허용), 내부감시기구→지배기구 등으로 바꾼다. edition_gate=true 후보는 적용 판본 결정 후 제작한다.',
      law: '외부감사법 원문은 2026-09-11 수집본(2025-04-01 개정 반영). 제작 시 국가법령정보센터 현행 조문과 시행령을 다시 대조한다.',
      kga: 'KICPA 2026년 7월 개정 감사기준서 전문 추출본. 시험 적용연도는 별도로 확정하지 않았다.',
    },
    candidates,
    deferred,
  };
  return { evidence, errors };
}

const { evidence, errors } = build();
const text = `${JSON.stringify(evidence, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(path.join(root, out)) ? fs.readFileSync(path.join(root, out), 'utf8') : '';
  if (current !== text) { console.error('evidence.json이 현재 입력과 다릅니다.'); process.exit(1); }
  console.log('evidence.json 일치');
} else {
  fs.writeFileSync(path.join(root, out), text);
  console.log(`evidence.json 작성: 후보 ${evidence.counts.candidate_areas}영역·${evidence.counts.candidate_units}물음(P1 ${evidence.counts.p1_units})`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
