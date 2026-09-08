# CPA 회계감사 문제 출제 LLM Wiki

> `cpa_uploader/data`를 출처로 하는 문제 생성 지식베이스.
> Last updated: 2026-09-08 | Content pages: 26 | v3 문제은행: 세트 96개 · criterion 521개

## Start Here

1. [[topic-map]] — 19개 공통 주제 탐색
2. [[coverage-map]] — v3 문제은행 세트 분포와 보강 우선순위
3. [[question-generation-workflow]] — 출처에서 linked question set을 만드는 절차
4. [[question-output-schema]] — 생성 JSON 계약
5. [[llm-question-generation-prompt]] — LLM 입력 템플릿

## Concepts

- [[ethics-independence-quality]] — KGA 200·KGA 220 · 윤리적 요구사항, 독립성, 품질관리, 업무품질관리, 모니터링 · v3 4세트
- [[audit-objectives-foundations]] — KGA 200 · 합리적인 확신, 감사위험, 전문가적 의구심, 전문가적 판단, 감사의 고유한계 · v3 5세트
- [[engagement-acceptance-contract]] — KGA 210 · 감사업무 조건, 감사계약, 감사의 전제조건, 수임, 계속감사 · v3 4세트
- [[planning-documentation-materiality]] — KGA 230·KGA 300·KGA 320 · 감사문서, 감사조서, 감사전략, 감사계획, 계획수립, 중요성, 수행중요성 · v3 5세트
- [[fraud-laws-governance-communication]] — KGA 240·KGA 250·KGA 260·KGA 265 · 부정, 법률과 규정, 법규, 지배기구, 내부통제 미비점, 커뮤니케이션 · v3 6세트
- [[risk-assessment-internal-control]] — KGA 315·KGA 330 · 중요왜곡표시위험, 위험평가절차, 내부통제시스템, 통제환경, 정보시스템, 통제활동 · v3 5세트
- [[responses-controls-substantive-procedures]] — KGA 330 · 평가된 위험, 추가감사절차, 통제테스트, 실증절차, 실증분석절차, 세부테스트 · v3 5세트
- [[audit-evidence-assertions]] — KGA 500 · 감사증거, 충분하고 적합, 경영진주장, 감사증거의 신뢰성, 감사절차 · v3 5세트
- [[inventory-litigation-confirmations-opening-balances]] — KGA 501·KGA 505·KGA 510 · 재고자산, 소송과 배상청구, 부문정보, 외부조회, 조회서, 기초잔액, 초도감사 · v3 7세트
- [[analytics-audit-sampling]] — KGA 520·KGA 530 · 분석적절차, 표본감사, 감사표본, 표본위험, 표본크기, 모집단 · v3 5세트
- [[estimates-related-parties]] — KGA 540·KGA 550 · 회계추정, 추정불확실성, 공정가치, 특수관계자, 특수관계 · v3 4세트
- [[completion-subsequent-events-going-concern]] — KGA 450·KGA 560·KGA 570·KGA 580 · 미수정왜곡표시, 왜곡표시의 평가, 후속사건, 계속기업, 서면진술 · v3 8세트
- [[service-organizations-internal-audit-experts]] — KGA 402·KGA 610·KGA 620 · 서비스조직, 수탁회사, 내부감사기능, 내부감사인, 감사인측 전문가, 전문가의 업무 · v3 5세트
- [[group-audit]] — KGA 600 · 그룹재무제표, 그룹감사, 그룹업무팀, 부문감사인, 부문재무정보, 연결절차 · v3 5세트
- [[audit-opinions-reports]] — KGA 700·KGA 705 · 감사의견, 감사보고서, 적정의견, 한정의견, 부적정의견, 의견거절, 의견변형 · v3 4세트
- [[kam-emphasis-comparatives-other-information]] — KGA 701·KGA 706·KGA 710·KGA 720 · 핵심감사사항, 강조사항문단, 기타사항문단, 비교정보, 대응수치, 비교재무제표, 기타정보 · v3 7세트
- [[internal-control-over-financial-reporting]] — KGA 1100 · 내부회계관리제도, 내부회계, 운영실태보고서, 전사적 수준 통제 · v3 4세트
- [[small-entity-audit]] — KGA 1200 · 소규모기업, 소규모 기업 · v3 4세트
- [[assurance-review-related-services]] — KGA 200 · 검토업무, 인증업무, 합의된 절차, 재무제표 검토, 예측재무정보 · v3 4세트

## Question Generation

- [[question-design]] — 3개 물음 유형과 정수 배점
- [[question-generation-workflow]] — 발문 우선 추출과 검증 절차
- [[question-output-schema]] — linked question set 출력 구조
- [[llm-question-generation-prompt]] — 출처 기반 생성 프롬프트

## Meta

- [[topic-map]] — 주제·기준서·탐색어 지도
- [[coverage-map]] — v3 문제은행 커버리지
- [[source-manifest]] — 원자료 해시·중복·NUL 상태
