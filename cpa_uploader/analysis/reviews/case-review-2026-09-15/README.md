# 사례형 지정 검토·수정

사용자가 지정한 사례형 문제만 차례로 검토·수정하는 작업의 검증 장부다. 범위와 공통 기준은 [authorization.md](authorization.md)와 [사례형 발문과 절차 선택형](../../../../docs/물음별-학습-단위와-분류-계약.md#사례형-발문과-절차-선택형)에 있다. 초안은 [drafts/case-review-2026-09-15](../../../drafts/case-review-2026-09-15/README.md)에 둔다.

| 회차 | 대상 | 결과 | 상태 |
| --- | --- | --- | --- |
| r01 v4 | 55·18·19 병합 → `case-14-group-procedures-20260915`(v3 초안 그대로) | [요약](r01/summary-v4.json): 대표 6답안 모두 기대점수와 일치 | 게시 근거 실행. 운영 반영 절차는 [publication](publication/) |
| r01 v3 | 같은 초안 | [요약](r01/summary-v3.json): 대표 6답안·보조 2답안 모두 기대점수와 일치 | authorization.md 해시가 달라 v4로 재실측. 증거 보존 |
| r01 v2 | 같은 세트의 둘째 판본 | [요약](r01/summary-v2.json): 대표 6답안 모두 일치 | 새 배점 기준으로 v3가 대체. 증거 보존 |
| r01 v1 | 같은 세트의 첫 판본 | [요약](r01/summary.json): 대표 6답안·보조 2답안 모두 일치 | 사용자 추가 지시로 v2가 대체. 증거 보존 |
| r02 v2 | 60·21 병합 + 기타정보 추가 요소 → `case-16-other-information-20260915`(v1 초안 그대로) | [요약](r02/summary-v2.json): 대표 6답안 모두 기대점수와 일치 | 게시 근거 실행 |
| r02 v1 | 같은 초안 | [요약](r02/summary-v1.json): 대표 6답안·보조 2답안 모두 기대점수와 일치 | authorization.md 해시가 달라 v2로 재실측. 증거 보존 |
| r03 v2 | 59·30 병합 → `case-13-payroll-service-20260915` | [요약](r03/summary-v2.json): 대표 6답안·보조 2답안 모두 기대점수와 일치 | 게시 근거 실행 |
| r03 v1 | 같은 세트의 첫 판본 | [요약](r03/summary-v1.json): 대표 6답안·보조 2답안 모두 일치 | 사실관계 단순화 요청으로 v2가 대체. 증거 보존 |
| r04 v2 | 29 재구성 + 초도감사 추가 요소 → `case-09-initial-audit-20260915` | [요약](r04/summary-v2.json): 대표 12답안 모두 기대점수와 일치(보조 4답안은 v1 문항으로 일치) | 게시 근거 실행 |
| r04 v1 | 같은 세트의 첫 판본 | [요약](r04/summary-v1.json): 대표 12답안·보조 4답안 모두 일치 | KGA 300 발췌본 v2 등록으로 v2가 대체. 증거 보존 |

사용자 결정(2026-09-15): 지정 검토의 정본·공개본·운영 DB 반영과 원 세트 퇴역은 검토를 모아 한 번에 한다. 그때 사례형 원 세트 퇴역을 위한 DB 변경을 한 번 준비하고, 운영 DB 명령은 사용자가 직접 실행한다.

실행 입력의 authorization.md: 모든 실행 manifest는 [authorization.md](authorization.md)를 입력 해시로 고정한다. r01 v3·r02 v1 manifest가 기록한 해시(`51a173b5…`)는 두 실행 뒤 이후 사용자 결정을 추가한 현재 파일(`fe924c2f…`)과 달라 승급 검증을 통과할 수 없으므로, 같은 초안을 현재 입력으로 다시 실측한 r01 v4·r02 v2를 게시 근거로 썼다(각 Luna 3회, 대표 6답안 모두 일치, 각 약 $0.0084·$0.0086). 이후 결정은 authorization.md를 고치지 않고 회차 README와 [수정 요청서](../../../../docs/case-question-edit-notes-2026-09-14.md)에 남긴다.

## 게시와 운영 반영

사용자 지시(2026-09-15): “불필요한 파일은 아카이브에 넣고 지적했던 문제들 대체해서 운영Db적용해줘”, 이어서 “불필요한 파일 정리후 커밋 푸시”, 2026-09-16 “운영DB 대체해줘”. 승인 기록은 [publication/authorization.md](publication/authorization.md), 퇴역·추가 계획은 [plan.json](publication/plan.json)이다. 원 8세트(`case-14-component-evidence-gap-20260914`·`pilot-14-006`·`pilot-14-007`·`case-16-other-information-cause-20260914`·`pilot-16-011`·`case-13-type2-period-exceptions-20260914`·`pilot-13-011`·`pilot-09-010`)를 빼고 새 4세트를 은행 끝에 붙였다.

| 단계 | 결과 | 기록 |
| --- | --- | --- |
| 수락 | 네 회차 효율 검수 batch와 receipt. 대표 답안 30개(6·6·6·12) 모두 기대점수와 일치 | [acceptance-completion.json](publication/acceptance-completion.json) |
| stage | 격리 경로에서 검수 승급·게시, 공개본·암호화본·분류 카탈로그, 전체 검증, DB 준비 검사 통과 | [stage-completion.json](publication/stage-completion.json), [DB 준비 보고](publication/stage/db-readiness.json), [단계 로그](publication/stage-logs/) |
| 정본 설치 | 375세트·564물음·1,907점 → 371세트·551물음·1,882점(사례형 192물음 → 179물음). 승급 장부 8건 추가, 카탈로그·전체 검증 통과 | [install-completion.json](publication/install-completion.json) |
| coverage | 퇴역 세트를 가리키던 은행 대상 관계 3건을 대체 물음으로 다시 연결(partial·adjacent·direct 유지 판단 기록). 초안 대상 관계 14건은 보존된 초안을 가리키므로 유지 | [coverage-update.json](publication/coverage-update.json), [관계 검토](publication/coverage-retarget-review.json) |
| wiki | 퇴역 세트 생성 페이지 8개를 원 바이트로 보존한 뒤 제거하고 새 4페이지를 생성 | [wiki-retirement](publication/wiki-retirement/manifest.json) |
| 사본 정리 | 대체된 판본의 후보 은행·분류·카탈로그 사본, 게시 stage·baseline·후보 사본 29개(약 90MB)를 저장소 밖으로 이동. 삭제하지 않음 | [copy-archive-2026-09-15.json](../copy-archive-2026-09-15.json) |
| 운영 DB 마이그레이션 | 2026-09-16 07:14(KST) `cpa_assert_reviewed_question_retirements(jsonb)` 한 함수만 교체(정의 해시 `bdb7dad4…` → `64a2f3b0…`). 권한·다른 6개 함수·active release 불변 | [완료](publication/db-migration/completion.json), [before](publication/db-migration/before.json)·[after](publication/db-migration/after.json) |
| 운영 DB 반영 | read-only probe 통과(payload `5e83d0ff…`) 뒤 apply 1회(service_role, 23초). 새 active release `906ca962-49f3-4155-8c9d-1b3014e6edda`. 왕복 검증: 원문 바이트·공개 payload·분류 551행·주제·학습 단위 441개 일치, 남은 367세트의 판본·분류 불변, 원 8세트 비활성, 새 4세트는 새 판본, 함수·권한·DB 설정 불변. 독립 검증(read-only 375요청, 쓰기 0) 통과 | [완료](publication/db-import/publication-v1/completion.json), [왕복](publication/db-import/publication-v1/roundtrip.json), [독립 검증](publication/db-import/publication-v1/verification.json), [준비](publication/db-import/preparation-v1/preparation.json) |
| DB 사본 정리 | 반영이 끝난 뒤 DB 전송 payload·guarded/probe SQL과 마이그레이션 SQL 사본 5개(약 1.3MB)를 저장소 밖으로 이동 | [copy-archive-2026-09-15-db.json](../copy-archive-2026-09-15-db.json) |

운영 DB 명령은 사용자가 직접 실행했다. ① `db-migration/driver.mjs --apply --expected-preparation-sha256 59782acb…`, ② agent가 `db-import/driver.mjs --prepare`(네트워크 없음)로 준비 기록(`852234ba…`)을 만들고 SQL의 함수 해시·기대 release·payload 해시·사후 검사를 대조했다, ③ 사용자가 `--probe`와 `--apply --expected-preparation-sha256 852234ba…`를 실행했다(모두 `node --env-file=.env.local --import tsx …`). apply는 재시도 없이 한 번 실행했다.

import 도구는 옮긴 stage·baseline 사본을 읽지 않는다. 최종 원문은 설치 기록으로 검증된 stage와 같은 바이트임을 확인한 정본에서, 기준 원문은 반영 전 커밋 `76e8da75`의 정본에서 기록한 SHA-256을 대조해 읽는다. 사본을 옮긴 뒤 자리표시 manifest로 한 로컬 PGlite 복원 시험의 payload 해시(`8a9fbc73…`)와 최종 원문 해시(`18082e54…`)가 옮기기 전과 같았고, 실제 준비는 퇴역 manifest를 넣어 payload `5e83d0ff…`가 되었다. 앱은 `CPA_LEARNING_DB_ENABLED=true`일 때 문항·채점 판본을 DB에서 읽으므로 이 반영 뒤 새 release(371세트)를 제공한다. 퇴역한 원 세트의 과거 판본·풀이 기록은 DB에 보존된다.

## r04 입력과 실행

29번(`pilot-09-010`)을 초도감사 종합 문제로 재구성한 4물음·12점이다. 사용자 선택에 따라 물음 1은 착수·계획 단계 선택형, 물음 2는 자료별 경영진주장 열거형, 물음 3은 당기 실사·수량 자료로 기초 재고 평가 증거까지 입수했다는 함정을 둔 선택형, 새 물음 4는 초도감사 보고(전임감사인 의견변형의 해소, 기타사항문단) 선택형이다. 원 물음 4(변형의견 계열)는 삭제했다.

- [초안과 모범답안](../../../drafts/case-review-2026-09-15/r04-initial-audit/questions-and-answers.md), [내용 검토](r04/root-content-review-v1.json), [계보](../../../drafts/case-review-2026-09-15/r04-initial-audit/lineage.json). KGA 300 문단 13은 2025 전문 PDF 182쪽에서 새로 발췌해 `cpa_uploader/data/official/case-review-2026-09-15-kga300.md`로 등록했다. raw 보존은 [수집 색인](../../../raw/collections/2026-09-15-case-review-r04/index.md)에 있다.
- 후보 은행 `r04/candidate-v1.json` = 현재 정본 375세트 + r04 초안(376세트·568물음·1,919점). 분류 `r04/classification-v1.json` → `r04/catalog-v1.json`(세 사본은 보관 폴더로 이동). 물음 2의 분류 사유에는 열거형이라 사실 의존도가 낮다는 한계를 적었다.
- [실행 manifest](r04/execution-v1/grading-manifest.json): 첫 실행 [actual-a](r04/execution-v1/actual-a/preflight.json)는 API 키를 불러오지 않아 호출 0회로 멈췄고 preflight만 보존했다. 같은 manifest로 [actual-a2](r04/execution-v1/actual-a2/summary.json)에서 Luna 3회를 실행해 대표 12답안 점수가 모두 기대점수와 일치했다. 식별 기준의 예상 `contradicted`·실제 `not_met` 차이 3건은 모두 0점 상태 차이이며 재채점하지 않았다.
- [보조 실측](r04/supplementary-v1/summary.json): 물음 1은 보완절차만, 물음 3·4는 이유만, 물음 2는 자료별로 나눠 한 자료에만 붙인 주장과 범주명(권리·의무, 정확성·평가 및 배분)을 쓴 답이 각각 3·4·3·2점을 받았고 판정까지 일치했다. 승급 receipt 분모에 넣지 않는다.
- v1 사용량: 4회, 약 $0.0151(제공자 사용량×공개 단가 추정, 청구액과 구별).
- v2: 새 KGA 300 발췌본은 판본 기록 줄이 없어 원자료 카탈로그가 앞 12줄의 원문 소제목 “시행일”을 판본 설명으로 표시했다. 출처·확인일 두 줄을 더하고 그 소제목을 뺀 발췌본 v2를 등록하고([raw v2 수집](../../../raw/collections/2026-09-15-case-review-r04-v2/index.md)), 초안은 kga300-13 출처 제목의 줄 표시만 고친 [v2](../../../drafts/case-review-2026-09-15/r04-initial-audit/v2/questions-and-answers.md)로 만들었다. 등록 파일 해시가 바뀌어 v1 실행 증거는 현재 입력으로 다시 검증할 수 없으므로 [내용 검토 v2](r04/root-content-review-v2.json), [candidate-v2](r04/candidate-v2.json)·[catalog-v2](r04/catalog-v2.json), [execution-v2](r04/execution-v2/grading-manifest.json)로 다시 실측했다. Luna 3회, 대표 12답안 점수 모두 일치(0점 상태 차이 3건). 보조 실측은 문항 내용이 같아 v1 결과를 인용한다. [요약](r04/summary-v2.json).
- r04 누적: 7회 약 $0.0264(v1 대표 3회 $0.0115, 보조 1회 $0.0036, v2 대표 3회 $0.0113). API 키 없이 끝난 v1 첫 시도는 호출 0회다. 정본 반영·원 세트 퇴역·승급 receipt 봉인은 [게시와 운영 반영](#게시와-운영-반영)에서 v2로 했다.

## r03 v2 입력과 실행

사용자가 v1을 검토해 달라며 사실관계가 너무 복잡하다고 했다. v1은 다른 세션이 작성했고, 이 세션이 원문과 다시 대조해 정답 판정·출처는 맞지만 쓰이지 않는 사실, 비슷한 이름, 한 검토조서 안의 모순된 기재(⑤·⑥·⑧)가 복잡도의 원인임을 확인했다([검토 소견](../../../drafts/case-review-2026-09-15/r03-payroll-service-merge/v2/design.json)).

- [v2 초안과 모범답안](../../../drafts/case-review-2026-09-15/r03-payroll-service-merge/v2/questions-and-answers.md), [내용 검토 v2](r03/root-content-review-v2.json), [v1과의 대응](../../../drafts/case-review-2026-09-15/r03-payroll-service-merge/v2/lineage.json). 쟁점 여덟 개의 옳고 그름·출처·배점(3점+4점)은 같고 사실관계는 1,494자에서 1,159자로 줄었다.
- 후보 [candidate-v2](r03/candidate-v2.json)·[catalog-v2](r03/catalog-v2.json), [execution-v2](r03/execution-v2/grading-manifest.json): Luna 3회, 대표 6답안 점수 모두 일치(식별 기준의 0점 상태 차이 1건). [보조 실측 v2](r03/supplementary-v2/summary.json): 번호 없이 내용으로 특정한 이유 3점, 보완절차만 쓴 답 4점, 판정까지 일치.
- 총 4회 약 $0.0094(제공자 사용량×공개 단가 추정). r03 누적 8회 약 $0.0185. 정본 반영·원 세트 퇴역·승급 receipt 봉인은 [게시와 운영 반영](#게시와-운영-반영)에서 v2로 했다.

## r03 v1 입력과 실행

급여 서비스조직의 보고서 범위, 보충적인 이용자기업 통제, 기간·통제변경·예외를 판단하는 2물음·7점이다. 원 두 세트의 5물음·12점을 간략한 이유 또는 보완절차를 쓰는 선택형으로 통합했다.

- [초안과 모범답안](../../../drafts/case-review-2026-09-15/r03-payroll-service-merge/questions-and-answers.md), [내용 검토](r03/root-content-review-v1.json), [전체 계보](../../../drafts/case-review-2026-09-15/r03-payroll-service-merge/lineage.json).
- [실행 manifest](r03/execution-v1/grading-manifest.json): Luna 3회, 대표 6답안 모두 기대점수와 일치. 번호만 쓴 답 1점, 함정 선택과 오류 누락이 있는 답에서 독립적으로 맞은 이유 2점 보존을 확인했다.
- [보조 실측](r03/supplementary-v1/summary.json): 내용으로 오류를 특정하고 이유만 쓴 답 3점, 간략한 보완절차만 쓴 답 4점. 대표 분모와 별도로 2답안 모두 일치.
- 예상 `contradicted`·실제 `not_met` 사이의 식별 기준 상태 차이 3건은 모두 0점으로 점수 영향이 없다. 실제 답안·기대표·원응답을 보존하며 이를 없애기 위한 추가 호출을 하지 않았다.
- 총 4회, 약 $0.00917(기존 2026-09-12 단가표와 실제 제공자 사용량에 따른 산술). 정본·DB·원 세트 퇴역과 승급 receipt 봉인은 미실행.

## r01 v3 입력과 실행

사용자가 r01도 새 배점 기준(옳지 않은 항목마다 이유 또는 보완절차 중 하나에 1점)으로 맞추라고 했다. v2의 사실관계·출처를 바이트까지 그대로 두고 발문·모범답안·criterion만 바꿨으며, 문항 내용이 달라져 새로 실측했다.

- 내용 검토: [root-content-review-v3.json](r01/root-content-review-v3.json). 후보 `r01/candidate-v3.json`, 분류 `r01/classification-v3.json` → `r01/catalog-v3.json`(보관 폴더로 이동).
- 대표 실측: [execution-v3](r01/execution-v3/grading-manifest.json). v2 대표 답안 원문을 그대로 쓰고 v3 기준으로 기대 판정을 실행 전에 다시 정했다. Luna 3회, 6답안 모두 기대점수와 정확히 일치.
- 보조 실측: [supplementary-v3](r01/supplementary-v3/summary.json). 물음 1은 보완절차만, 물음 2는 이유만 쓴 답이 각 3점을 받는지 확인했고 판정까지 일치했다.
- 사용량: 4회 약 $0.0106. r01 누적 12회 약 $0.0345(제공자 사용량×공개 단가 추정).

## r02 v1 입력과 실행

기타정보(KGA 720) 종합 문제다. 옳지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 1점 주는 새 배점 기준을 처음 적용했다.

- 내용 검토: [root-content-review-v1.json](r02/root-content-review-v1.json). 작성 agent가 등록 전문(KGA 720 문단 1~23·A44~A50, KGA 705 문단 7·29, KGA 315 문단 37, KGA 330 문단 6)을 대조한 기록이다.
- 후보 은행 `r02/candidate-v1.json` = 현재 정본 375세트 + r02 초안. 분류 `r02/classification-v1.json` → `r02/catalog-v1.json`(보관 폴더로 이동. 같은 초안의 게시 근거 실행 v2는 [candidate-v2](r02/candidate-v2.json)·[catalog-v2](r02/catalog-v2.json)).
- 대표 실측: [execution-v1](r02/execution-v1/grading-manifest.json)을 dry-a 후 actual-a로 실행했다. Luna 3회, 6답안 모두 기대점수와 정확히 일치. 부분정답에는 함정 ③·⑦ 선택과 ⑤·⑧ 누락을 넣었다.
- 보조 실측: [supplementary-v1](r02/supplementary-v1/summary.json). 물음 1은 보완절차만, 물음 2는 이유만 쓴 답이 각 4점을 받는지 확인했고 판정까지 일치했다. 승급 receipt 분모에 넣지 않는다.
- 사용량: 4회 약 $0.0112(제공자 사용량×공개 단가 추정, 청구액과 구별).

## r01 v2 입력과 실행

사용자 추가 지시에 따라 절차 ⑤의 옳음을 암시하던 책임 귀속 문장을 줄이고, 자료 4를 매출·소송충당부채별로 옳은 절차와 옳지 않은 절차를 하나씩 둔 구성으로 바꾸었다. 문항 내용이 달라져 v1 관측을 재사용하지 않고 새로 실측했다.

- 내용 검토: [root-content-review-v2.json](r01/root-content-review-v2.json). 작성 agent가 등록 전문(문단 11·41(e)·A9·A43·A44 추가)을 대조한 기록이며 독립 교차검토·사람 확인이 아니다.
- 후보 은행: `r01/candidate-v2.json` = 현재 정본 375세트 + v2 초안. 분류는 `r01/classification-v2.json` → `r01/catalog-v2.json`(보관 폴더로 이동).
- 대표 실측: [grading-manifest.json](r01/execution-v2/grading-manifest.json)을 [dry-a](r01/execution-v2/dry-a/summary.json) 후 [actual-a](r01/execution-v2/actual-a/summary.json)로 실행했다. Luna 3회 호출, 6답안 모두 기대점수와 정확히 일치. 부분정답에는 함정 ③·⑨ 선택을, 오답에는 함정 ⑤·⑥만 고른 답을 넣었다.
- 보조 실측은 새로 하지 않았다. 식별 기준의 번호만 쓴 답·내용 특정 답 판정은 v1 보조 실측에서 확인했다.
- 사용량: v2 3회 약 $0.0099, v1을 합친 누적 8회 약 $0.0239. 제공자 사용량에 공개 단가를 곱한 추정이며 청구액과 구별한다.

## r01 v1 입력과 실행

- 내용 검토 [root-content-review.json](r01/root-content-review.json), 후보 `r01/candidate-v1.json`, 분류 `r01/classification-v1.json` → `r01/catalog-v1.json`(보관 폴더로 이동).
- 대표 실측 [execution-v1](r01/execution-v1/grading-manifest.json): Luna 3회, 6답안 일치. 보조 실측 [supplementary-v1](r01/supplementary-v1/summary.json): 번호만 쓴 답(물음별 1점)과 번호 없이 내용으로 특정한 완전 답안(만점) 2회, 모두 일치. 보조 실측은 승급 receipt 분모에 넣지 않는다.

두 판본 모두 기대 판정과 실제 판정의 상태 차이(contradicted/not_met)는 0점 상태 사이의 차이이며 원 기대값을 바꾸거나 재채점하지 않았다.

## 도구

[run-efficient-grading.ts](tools/run-efficient-grading.ts)·[accounting.ts](tools/accounting.ts)·[contract.ts](tools/contract.ts)는 `case-trio-next-2026-09-14/helpers`의 바이트 동일 사본이다([provenance.json](tools/provenance.json)). [build-round.mjs](tools/build-round.mjs)는 회차·판본을 인자로 받아 후보 은행·분류 입력·채점 manifest를 만들고, [summarize-round.mjs](tools/summarize-round.mjs)는 대표·보조 실측을 요약한다. [record-r02-review.mts](tools/record-r02-review.mts)는 r02 내용 검토를 한 번 기록한 도구다. [build-r01.mjs](tools/build-r01.mjs)는 execution-v1의 고정 입력이라 그대로 둔다. [run-supplementary.ts](tools/run-supplementary.ts)는 표적 사례를 운영 채점 경로로 실행한다. r04부터는 기록된 원본 도구의 바이트를 유지하려고 후속판을 따로 두었다. [build-round2.mjs](tools/build-round2.mjs)는 설계 장부의 `classification_note`를 분류 사유에 쓰고(열거형 물음 등), [summarize-round2.mjs](tools/summarize-round2.mjs)는 `--actual`로 대표 실측 폴더를 지정한다. [record-r04-review.mts](tools/record-r04-review.mts)·[record-r04v2-review.mts](tools/record-r04v2-review.mts)는 r04 v1·v2, [record-r03v2-review.mts](tools/record-r03v2-review.mts)는 r03 v2 내용 검토를 한 번씩 기록한 도구다. 실제 채점과 보조 실측은 `node --env-file=.env.local --import tsx …`로 실행해야 API 키를 불러온다.

```sh
node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/build-round.mjs --round r01 --version v2 --draft-dir cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v2 --set-id case-14-group-procedures-20260915 candidate
npx tsx scripts/build-learning-unit-catalog.ts --review cpa_uploader/analysis/reviews/case-review-2026-09-15/r01/classification-v2.json --output cpa_uploader/analysis/reviews/case-review-2026-09-15/r01/catalog-v2.json
node --import tsx cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/build-round.mjs --round r01 --version v2 --draft-dir cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v2 --set-id case-14-group-procedures-20260915 execution
```

위 명령은 새 출력 경로에만 쓴다. 실제 채점 명령은 manifest SHA를 지정해야 하며 기존 출력이 있으면 중단한다. 정본·공개본·운영 DB 반영과 승급 receipt 봉인은 사용자 승인 뒤 새 기록으로 진행한다. 운영 퇴역 RPC의 검사 함수(`cpa_assert_reviewed_question_retirements`)는 기준서형 세트만 받았으므로, 모든 물음이 자기 세트의 사례형으로 분류된 세트도 받도록 [20260915090000 마이그레이션](../../../../supabase/migrations/20260915090000_cpa_reviewed_case_question_retirements.sql)을 두었다([PGlite 회귀](../../../../tests/cpaCaseQuestionRetirementsDatabase.test.ts)). 게시 도구는 [publication](publication/)에 있다.
