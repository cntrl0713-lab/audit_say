# 사례 보강·기준서형 분리·운영 반영 결과 — 2026-09-13

기존 사례 41개를 전수 조사하고 미달 사례 23개를 보강했다. 기출문제와 고급 회계감사 연습의 실제 발문·답안, 관련 공식 기준서 원문을 대조하여 새 사례 2개를 추가했다. 현재 사례 43개는 모두 사실관계 400자 이상, 사례형 물음 2개 이상이다. 가장 짧은 사실관계는 427자다. 정본·공개본·운영 DB 반영 및 독립 조회 검증을 완료했다.

시작 시 사례형 물음이 2개 미만인 사례는 19개, 사실관계가 400자 미만인 사례는 19개였으며, 두 조건의 합집합이 보강한 23개다. [독립 전후 대조](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/report-counts.json)에 집계와 보존 검사를 기록했다.

## 전후 변화

| 구분 | 시작 | 이번 사례 작업만 반영 | 병행 작업을 보존한 최종 게시본 |
| --- | ---: | ---: | ---: |
| 저장 세트 | 155 | 180 | 186 |
| 전체 물음 | 364 | 390 | 403 |
| 기준서형 독립 물음 | 288 | 288 | 301 |
| 사례형 물음 | 76 | 102 | 102 |
| 사례 부모 | 41 | 43 | 43 |
| 학습 단위 | 329 | 331 | 344 |
| 전체 배점 | 1298 | 1367 | 1429 |

게시 준비 중 다른 작업이 추가한 기준서형 6세트·13물음을 감지했다. 원본 보호 검사가 v1 설치를 막았고, 그 추가 문항·분류·검수 이력을 모두 보존한 v2 병합본을 검증해 설치했다. 이를 이번 사례 작업의 신규 제작으로 계상하지 않는다. [병합 근거](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/publication-v2/merge-evidence.json)에 별도로 기록했다.

기준서형 35물음은 사례에서 분리해 23개 별도 저장 묶음으로 옮겼다. 앱에서는 각 물음을 독립 학습한다. 기존 앱의 독립 발문·모범답안·요구사항·채점기준·배점을 유지했으며, 기준서형 전체 수는 늘리지 않았다. [분리 계보](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/standard-lineage.json)와 [기준별 계보](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/criterion-lineage.json)에 이전 위치와 현재 위치를 기록했다. 과거 봉인 판본·시도·검수 receipt는 보존했다.

## 보강 내역

글자 수는 제목·발문을 제외하고 facts의 본문을 줄바꿈 하나로 결합한 문자열의 유니코드 코드포인트 수이며 공백을 포함한다. 분량을 늘리는 데 그치지 않고, 감사 대상·시점·증거·관계자 주장·잘못된 계획을 물음의 판단과 절차 선택에 대응시켰다. 사실을 제거하면 같은 만점 답안이 성립하는 물음은 독립 기준서형으로 분리했다.

| 기존 사례 ID | 사실관계 글자 수 | 사례형 물음 수 |
| --- | ---: | ---: |
| pilot-04-005 | 86 → 595 | 1 → 2 |
| pilot-12-001 | 140 → 608 | 1 → 2 |
| pilot-13-007 | 107 → 583 | 1 → 2 |
| draft-04-320-freq01 | 230 → 616 | 1 → 2 |
| draft-09-501-freq01 | 119 → 586 | 1 → 2 |
| pilot-03-005 | 392 → 645 | 1 → 2 |
| pilot-04-006 | 173 → 626 | 1 → 2 |
| pilot-07-007 | 356 → 623 | 1 → 2 |
| pilot-14-007 | 390 → 627 | 3 → 3 |
| pilot-16-011 | 290 → 602 | 1 → 2 |
| pilot-02-007 | 368 → 616 | 2 → 2 |
| pilot-03-006 | 369 → 619 | 1 → 2 |
| pilot-04-007 | 150 → 597 | 1 → 2 |
| pilot-08-008 | 408 → 623 | 1 → 2 |
| pilot-06-008 | 462 → 646 | 1 → 2 |
| pilot-13-011 | 211 → 637 | 1 → 2 |
| pilot-10-006 | 386 → 607 | 2 → 2 |
| pilot-10-007 | 377 → 633 | 1 → 2 |
| pilot-12-009 | 220 → 591 | 1 → 2 |
| pilot-12-010 | 411 → 633 | 1 → 2 |
| pilot-15-006 | 526 → 669 | 1 → 2 |
| pilot-16-012 | 316 → 605 | 1 → 3 |
| pilot-14-008 | 300 → 613 | 2 → 2 |

| 추가 사례 | 제목 | 사실관계 | 물음 |
| --- | --- | ---: | ---: |
| case-05-management-override-20260913 | 특별 권한 분개와 낙관적인 추정치에 대한 대응 | 669자 | 3 |
| case-11-undisclosed-related-party-20260913 | 누락된 특수관계자 보증과 정상거래조건 주장 | 689자 | 3 |

요구량이 큰 독립 상황은 물음을 분리하고, 판단·근거 및 별도 절차는 각각의 독립 의미에 정수 배점을 부여했다. 문서화 5개 요소, 현재 경영진의 서면진술 책임과 미입수 효과, 보고서 단락의 기능 등은 발문·모범답안·기준을 함께 대조했다. 새 분개 사례에서는 이미 주어진 계획을 다시 쓰면 점수를 받던 초안을 수정해, 누락된 수동 조정분개 검사를 찾아 보완하도록 바꿨다.

## 출처와 내용 검토

[제작 배치](../../cpa_uploader/drafts/case-expansion-2026-09-13/README.md)의 a/b/c/root 폴더에 각 사례의 출제 계획, 실제 source unit, 기출·고급연습의 발문·답안 위치, 공식 문단, 사실-물음 연결, 배점 결정과 QA를 보존했다. 기출·모의·연습의 빈도는 합산하지 않았다. 신규 사례는 기존 요구의 사례 적용을 보강하는 목적이며 미출제 확정을 주장하지 않는다.

작성 담당 agent와 총괄 agent가 변경 사례의 모든 물음·모범답안·채점기준·기대답안을 대조했다. 추가로 [B 교차 검토](../../cpa_uploader/drafts/case-expansion-2026-09-13/c/cross-review-b.json)와 [신규 사례 교차 검토](../../cpa_uploader/drafts/case-expansion-2026-09-13/a/root-peer-review.json)를 수행했다. 발견한 내용 결함은 통합 전에 수정했으며 미해결 내용 결함은 없다. 별도 유료 API 의미검수나 사람의 내용 확인으로 기록하지 않았다. 이번에 내용이 바뀌지 않은 기존 18개 사례는 앞선 전수 검토와 유효한 실측 증거를 유지한다.

## 실제 채점과 검사

Luna(gpt-5.6-luna)로 변경·신규 사례 25개와 이동 기준서형 35물음, 합계 89물음을 검증했다. 모범·대표 부분·대표 오답 264개 중 253개가 기대점수와 정확히 일치했고 263개가 ±1점 이내였다(99.62%). 실제 SDK 호출 190회, 기록된 토큰 기준 추정 비용 확정 불가(사용량 미반환 10회, 비용 미확인 0회, 캐시 쓰기량 미기록 0회)이다. 이 비율은 이번 대표 답안의 실측 결과이며 모든 학생 답안의 정확도나 통계적 신뢰수준이 아니다.

[봉인 결과](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/sealed-v1/summary.json), [최초 실행 입력](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/execution-v1/grading-manifest.json), [최종 재개 실행 입력](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/execution-resume-v4/grading-manifest.json)에 모든 관측·요청 식별자·입출력/캐시 토큰·실측 비용 근거를 연결했다. ±1점 내 편차를 없애기 위한 반복 호출은 하지 않았다. 배치 예산 $20, 제공자 한도 방식이며 실패를 분모에서 제외하지 않았다.

허용 범위 밖 결과는 1개다. [잔여 채점 차이 조사](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/residual-findings-v1.json)에 원 답안·기대값을 유지한 채 원인과 학습 영향을 기록했다. 내용·출처·발문·배점의 오류를 5% 허용으로 면제하지 않았으며, 모델이 문맥의 의미를 지나치게 엄격하게 해석한 실측 편차는 배치 정책에 따라 별도로 남겼다.

DNS 연결 오류로 두 차례 실행이 중단되어 [첫 재개](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/execution-resume-v2/recovery.json)와 [최종 재개](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/execution-resume-v4/recovery.json)를 기록했다. 처음 90개, 다음에는 누적 148개 관측을 원 경로·해시로 재사용하고 미완료 요청만 수행했다. v3 사전 검사의 복구 기록 제약은 [보존한 실패](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/execution-resume-v3/preflight-failure.json)와 [기록 소비자 수정](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/execution-resume-v4/recorder-revision.json)에 연결했다. 실제 채점 동작·답안·기대값은 바꾸지 않았고, 정확히 동일한 코드의 조상 보존본만 허용하는 검증을 회귀 테스트로 확인했다. 기존 오류와 중단 로그는 삭제하지 않았다. 사용량이 반환되지 않은 호출 10회가 있어 전체 비용을 0이나 확정 금액으로 표시하지 않았다. 반환된 응답의 비용 합계 범위는 $0.2390394~$0.2390394이며 전체 청구액과 구별한다.

- 대상 제작·통합·게시 스크립트 ESLint: 통과
- questionEfficientReview 회귀 테스트 59개 및 대상 ESLint: 통과
- npm run typecheck: 통과
- 최종 재개·봉인·게시 스크립트 ESLint: 통과
- 병행 문항 보존·병합 게시 스크립트 ESLint: 통과
- 정본·공개본·암호화본 검증 및 승급 장부 보존: 통과
- npm run analysis:build → analysis:check: 통과
- npm run wiki:build → wiki:check: 통과
- npm run learning:catalog:check: 통과
- Luna 대표 답안 264개 검증(263개 ±1점 이내): 통과
- 운영 DB 게시 및 활성 릴리스 독립 조회 검증: 통과

## 반영과 보존

정본·공개본·암호화본·학습 분류를 함께 검증해 설치했고 승급 장부에 기존 23세트의 재검수, 신규 25세트의 검수와 48세트의 게시 기록을 추가했다. [설치 기록](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/publication-v2/install-completion.json)은 병행 작업을 포함한 기존 장부 보존과 이번 작업의 추가 96개 기록을 확인한다.

운영 릴리스 ID: **03697916-2d4c-4f52-88bc-938a3b2ef10f**. 대상 프로젝트는 xvifzicrjmbfqaepcfpp.supabase.co이며, [배포 기록](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/db-publication-v1/completion.json)과 [독립 검증](../../cpa_uploader/analysis/reviews/case-expansion-2026-09-13/db-publication-v1/verification.json)으로 실제 활성 릴리스·공개/사설 페이로드·학습 단위·배점을 대조했다. 기존 이력은 삭제하지 않았다.

coverage의 기존 연결은 이동한 criterion 위치로 다시 연결하고 이전 snapshot을 보존했다. 관계 의미를 새로 승인했다고 기록하지 않았다. 생성 분석·wiki는 현재 입력에서 다시 생성했다. 이 작업에서 앱 실행 코드는 바꾸지 않았으며 운영 DB 게시본이 갱신된 결과다.
