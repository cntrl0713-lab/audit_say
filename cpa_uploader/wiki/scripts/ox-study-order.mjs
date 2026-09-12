import { topicDefinitions } from './topic-definitions.mjs';

export const oxBookRelative = 'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/필수암기_OX_200제.md';

// Display order only: IDs, source mappings and authoring JSON positions stay stable.
const topicIds = ['02', '01', '03', '04', '08', '06', '07', '09', '05', '11', '13', '10', '12', '15', '16', '14', '17', '18', '19'];
if (new Set(topicIds).size !== topicDefinitions.length || topicIds.length !== topicDefinitions.length
  || topicDefinitions.some((topic) => !topicIds.includes(topic.id))) {
  throw new Error('OX study order must include every topic exactly once');
}
export const studyTopics = topicIds.map((id) => topicDefinitions.find((topic) => topic.id === id));

// CM labels refer to the chapters inside Part 1, not the book's three large parts.
// Pages are the Markdown source's "원문 페이지" numbers, not printed page numbers.
export const oxStudyChapters = [
  { label: 'CM1 회계감사의 기본개념', page: 20, endPage: 23, questions: '1–9', topics: [['02', '감사의 목적·기본개념']] },
  { label: 'CM2 감사인의 자격과 책임', page: 24, endPage: 28, questions: '10–20', topics: [['01', '윤리·독립성·품질관리와 책임']] },
  { label: 'CM3 감사계약의 체결', page: 29, endPage: 34, questions: '21–34', topics: [['03', '수임·선임·감사계약']] },
  { label: 'CM4 감사절차 수행을 위한 기본개념', page: 35, endPage: 43, questions: '35–61', topics: [['04', '중요성·문서화'], ['08', '감사증거'], ['10', '분석적절차'], ['09', '외부조회'], ['02', '감사위험 모형'], ['07', '위험과 감사절차의 관계']] },
  { label: 'CM5 감사의 계획수립과 위험평가절차', page: 44, endPage: 48, questions: '62–73', topics: [['04', '계획수립'], ['06', '위험평가'], ['07', '전반적 대응']] },
  { label: 'CM6 내부통제와 통제테스트', page: 49, endPage: 55, questions: '74–92', topics: [['06', '내부통제 이해'], ['07', '통제테스트'], ['05', '통제미비점 커뮤니케이션'], ['13', '서비스조직']] },
  { label: 'CM7 계정과목별 실증절차', page: 56, endPage: 60, questions: '93–106', topics: [['07', '실증절차'], ['09', '기초잔액·재고자산']] },
  { label: 'CM8 특정항목에 대한 실증절차', page: 61, endPage: 72, questions: '107–139', topics: [['05', '부정·법규'], ['09', '소송과 배상청구'], ['11', '회계추정치·특수관계자'], ['13', '전문가 활용']] },
  { label: 'CM9 표본감사', page: 73, endPage: 73, questions: '140–142', topics: [['10', '감사표본']] },
  { label: 'CM10 실증절차의 마무리', page: 74, endPage: 79, questions: '143–157', topics: [['12', '계속기업·후속사건·서면진술'], ['05', '지배기구 커뮤니케이션']] },
  { label: 'CM11 감사의견의 형성과 감사보고서의 작성', page: 80, endPage: 84, questions: '158–175', topics: [['12', '왜곡표시 평가'], ['15', '감사의견·보고서'], ['16', '핵심감사사항·강조사항·기타정보']] },
  { label: 'CM12 그룹재무제표에 대한 감사', page: 85, endPage: 89, questions: '176–190', topics: [['14', '그룹감사']] },
  { label: 'CM13 내부회계관리제도의 감사와 검토 및 기타주제', page: 90, endPage: 94, questions: '191–200', topics: [['17', '내부회계관리제도'], ['18', '소규모기업 정의(200번)']] },
  { label: '보충: 중간재무제표 검토 OX', page: 150, endPage: 151, questions: '심화 OX', topics: [['19', '검토업무; 인증·관련서비스 전체를 포괄하는 장은 아님']] },
];

for (const chapter of oxStudyChapters) {
  if (chapter.topics.some(([id]) => !topicIds.includes(id))) throw new Error(`Unknown study chapter topic: ${chapter.label}`);
}
