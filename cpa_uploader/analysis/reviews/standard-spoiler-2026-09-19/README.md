# 기준서형 수정·스포일러 전수 검토 (2026-09-19)

사용자 요청 “기준서형 물음에서도 수정할 사항과 스포일러요소를 확인하고 수정해줘”에 따라 현재 정본의 기준서형 물음 372개를 발문·모범답안·criterion·출처와 대조하고, 발문이 득점 내용을 알려 주거나 채점 입력이 어긋난 물음을 게시 문항 수정 경로로 고쳤다. 범위와 승인 경계는 [authorization.md](authorization.md), 적용한 규칙은 [기준서형 발문의 정답 암시 금지](../../../../docs/물음별-학습-단위와-분류-계약.md#기준서형-발문의-정답-암시-금지)와 [배점과 물음별 타당성](../../../../docs/물음별-학습-단위와-분류-계약.md#배점과-물음별-타당성)에 있다.

## 결과 요약

- v1(전수 검토): 179세트(혼합 세트 4개 포함)·232물음. 기준서형 수정 199물음(발문 198, criterion 명제 17물음, critical_facts 6물음, 답안 형식 9, 모범답안 15, criterion 삭제 3물음, 문단 40 criterion 재배치 2세트, 공개 선택지 삭제 1). 형제 물음 25개와 혼합 세트의 사례형 물음 8개는 바꾸지 않고 함께 대조했다.
- 발견 등급(plan-v1.json의 `tier`): A 99(발문이 정답 항목·핵심어·결론을 직접 제공), B 77(판단 방향·답의 구조·다른 물음의 정답 노출), B- 22(약한 유도), X 1(스포일러 외 형식 오류).
- 배점 변경: pilot-09-007 10→8점(발문 유도로만 성립하던 판단 2점 삭제), pilot-05-006 3→2점, std-points-20260914-da16629297a8 4→3점(같은 판단을 되풀이한 기준 삭제). 나머지 세트는 배점 유지.
- v2(첫째 후속): v1 실측에서 드러난 채점 입력의 내용 오류 5세트를 고쳤다. 허용 범위(±1점) 안의 편차였더라도 명제·모범답안이 출처나 발문과 어긋난 것은 면제하지 않았다. 내용은 [plan-v2.json](plan-v2.json)과 아래 [실측](#실측) 절에 있다.
- v3(둘째 후속): 발문이 적용 기준을 묻지 않는데 명제가 기준서 번호를 득점 요건처럼 담은 criterion을 전수 확인(13개)해 3세트를 고쳤다([plan-v3.json](plan-v3.json)).
- 세 판본 모두 로컬 정본에 설치했고, 2026-09-19 사용자 지시(“운영DB 대체”)로 운영 문제은행에 반영했다(릴리스 `c43c59e4-f074-4115-b816-a0a8218dd9d3`, 아래 [운영 반영](#운영-반영)).

## 수동 입력

| 파일 | 내용 |
| --- | --- |
| [plan-v1.json](plan-v1.json) | 물음별 agent 대조 기록. `issue`(발견), 새 발문·명제·모범답안·critical_facts, `review`(대조한 문단과 criterion 일치 확인·배점 결정) |
| [representatives-authored-v1.json](representatives-authored-v1.json) | v1에서 새로 쓴 부분정답·오답 192개와 실행 전 기대 판정 |
| [representatives-reused-v1.json](representatives-reused-v1.json) | 기존 검수 배치에서 답안 문장을 그대로 다시 쓴 대표 답안 271개의 선택(원본 파일·해시·행). 당시 은행과 현재 criterion이 같거나 문장부호·설명만 다른 경우만 골랐다 |
| [residual-findings-v1.json](residual-findings-v1.json) | v1의 허용 범위 밖 결과 1건의 원인 조사(이후 v2에서 명제를 고쳐 해소) |
| [plan-v2.json](plan-v2.json), [representatives-reused-v2.json](representatives-reused-v2.json) | v2 계획(5세트·6물음)과 v1 대표 답안 12개의 재사용·기대 판정 재대조 |
| [plan-v3.json](plan-v3.json), [representatives-authored-v3.json](representatives-authored-v3.json), [representatives-reused-v3.json](representatives-reused-v3.json) | v3 계획(기준서 번호 명제 13개의 전수 확인과 3세트 수정), 새 대표 답안 3개, v1 대표 답안 3개의 재사용 |
| [authorization.md](authorization.md), [policy-input.json](policy-input.json) | 범위·승인 경계, 금액 상한 미지정 |

## 생성 결과

| 경로 | 만드는 도구 |
| --- | --- |
| `cpa_uploader/corrections/20260919-<set_id>--standard-spoiler.json` 179개, [corrections-v1.json](corrections-v1.json) | [tools/build-corrections.mts](tools/build-corrections.mts) `--write` |
| `cpa_uploader/corrections/20260919-<set_id>--standard-spoiler-followup.json` 5개, [corrections-v2.json](corrections-v2.json) | [tools/build-corrections-v2.mts](tools/build-corrections-v2.mts) `--write` |
| `cpa_uploader/corrections/20260919-<set_id>--standard-spoiler-followup2.json` 3개, [corrections-v3.json](corrections-v3.json) | [tools/build-corrections-v3.mts](tools/build-corrections-v3.mts) `--write` |
| [evidence-v1/](evidence-v1/), [evidence-v2/](evidence-v2/), [evidence-v3/](evidence-v3/) 부분 은행·분류 입력·카탈로그·검사 기록 | `node --import tsx cpa_uploader/correct_cpa_v3.ts evidence <해당 판본의 correction> --out-dir …/evidence-vN` |
| [execution-v1/](execution-v1/), [execution-v2/](execution-v2/), [execution-v3/](execution-v3/) 대표 답안·범위·정책·agent 검토·실행 코드 사본·학습 단위 투영·manifest | [tools/build-execution.mts](tools/build-execution.mts) `--version v1`, [tools/build-execution-v2.mts](tools/build-execution-v2.mts) `--version v2`, [tools/build-execution-v3.mts](tools/build-execution-v3.mts) `--version v3` |
| `execution-vN/dry-{a,b,c}`, `execution-vN/actual-{a,b,c}` | [tools/run-efficient-grading.ts](tools/run-efficient-grading.ts) |
| `batch-vN.json`, `batch-vN-validation.json` | [tools/seal-batch.mts](tools/seal-batch.mts) `--version vN` (v1은 `--residual residual-findings-v1.json`) |
| `cpa_uploader/analysis/coverage/links.json`의 관계 갱신, [coverage-links-before-v1.json](coverage-links-before-v1.json)·[coverage-links-before-v3.json](coverage-links-before-v3.json) 보존본 | [tools/update-coverage.mjs](tools/update-coverage.mjs), [tools/update-coverage-v3.mjs](tools/update-coverage-v3.mjs) `--apply` |

`tools/run-efficient-grading.ts`·`contract.ts`·`accounting.ts`는 [사례형 검토 배치의 도구](../case-review-2026-09-15/tools/)를 바이트 그대로 복사했다(SHA-256 각각 `e0008048…`, `e878c9af…`, `bc9a8595…`). 봉인한 manifest가 고정한 파일(계획·대표 답안·도구·v1 결과 파일)은 고치지 않으며, 후속 판본은 입력과 이름만 바꾼 도구 사본(`*-v2.mts`, `*-v3.mts`)으로 만든다.

## 수정 방식

- 세트당 correction 하나로 발문·명제·critical_facts·모범답안·형식·선택지만 바꾸고 학습 유형·주제·물음 구성은 그대로 둔다. std-points 세트의 제목은 옛 발문과 같았으므로 새 발문으로 맞췄다(기준서형 화면의 제목은 독립 발문이다).
- 같은 문단을 나눈 물음은 다른 물음의 정답을 제외 문구로 나열하지 않도록 문단·항 기호(예: 700.13(a)·(b), 720.22(a)~(c)), 단계 순서(1100.23의 처음 네 단계), 중립 주제명으로 범위를 정했다. KGA 600 문단 40은 두 물음이 (c)·(d)를 문장 단위로 나눠 가져 기호로 범위를 정할 수 없었으므로 `std-points-20260914-69b535e26ab0`의 crit3(40(c) 한도기준)과 `std-points-20260914-4760b36cae38`의 crit10(40(d) 식별된 위험)을 맞바꿔 각각 40(a)·(b)·(d)와 40(c)를 묻게 했다(점수·명제 유지).
- 발문에서 조건을 빼거나 판단 유도를 없앤 물음은 채점 모델이 함께 읽는 criterion 명제·critical_facts·모범답안의 옛 발문 참조(“이 발문 문맥에서는…”, “제시된 전제하에”)와 판단 문장(“적절하지 않다.”)을 새 발문에 맞췄다.
- pilot-13-008 sub1은 공개본에 나가던 선택지(`decision.options`)가 정답 문장을 담고 있어 삭제했다(채점은 선택지를 쓰지 않는다).
- 혼합 세트(pilot-11-005, pilot-16-008, pilot-18-005, pilot-19-005)의 사례형 물음은 바꾸지 않았다. 그중 pilot-16-008 sub4, pilot-18-005 sub4는 발문이 판단 축을 알려 주고 pilot-18-005·pilot-19-005는 실제 연도를 쓰므로 사용자 지정 사례 검토 대상으로 남긴다.

## 실측

모든 판본은 Luna(`gpt-5.6-luna`)로 물음마다 모범답안·부분정답(2점 이상)·오답을 한 요청씩 채점했다. 금액은 제공자 사용량에 공개 단가를 곱한 산술값이며 청구서가 아니다. 반복 호출은 하지 않았다.

| 판본 | 세트·물음 | 요청 | 답안 | ±1점 이내 | 기대 점수 일치 | 토큰(입력/출력) | 금액 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v1 | 179·232 | 684 | 695 | 694 (99.86%) | 677 | 1,949,497 / 213,498 | $0.7435 |
| v2 | 5·6 | 18 | 18 | 18 | 18 | 50,015 / 5,543 | $0.0192 |
| v3 | 3·3 | 9 | 9 | 9 | 9 | 25,797 / 2,497 | $0.0094 |

v1의 기대 점수 불일치 18건은 모두 원인을 대조했다.

- 내용 오류로 판정해 고친 것(v2): 모범답안 −1 세 건 — pilot-15-002 sub2(crit7.p2의 '공시를 포함한'이 KGA 700 문단 14(a)에 없는 한정어), std-points-20260914-b10e300423f0 sub3(crit5의 비요구 설명 문장이 요건으로 읽힘, 같은 원인으로 부분정답 −1), std-points-20260914-0d598cf9ff4c sub2(모범답안에 crit2의 '입수한 감사증거에 근거할 때'가 없음). 부분정답 두 건 — pilot-17-004 sub2 −1(발문이 제외한 상대방·형식을 명제가 요구), std-points-20260914-c2034c10008a sub2 −2(발문이 준 토의 주체를 명제가 요구, 유일한 허용 범위 밖 결과이며 [residual-findings-v1.json](residual-findings-v1.json)에 기록).
- 내용 오류로 판정해 고친 것(v3): std-points-20260914-2ae588b5cc20 sub2 부분정답 −1(“감사기준서 705에 따른다는 요건이 없음”). 같은 유형인 pilot-13-008 sub1 crit1, draft-standard-followup-20260913-s05 sub1 crit1·crit2·crit4도 함께 고쳤다. 발문이 기준서를 묻는 pilot-18-001·pilot-18-003·std-points-20260914-3e6441db2bd9와 배점 설명인 std-points-20260914-4906e3107ecd는 유지했다.
- 채점 일관성으로 판정해 유지한 것: 부분정답 −1 일곱 건(draft-standard-additional-20260913-s02 sub3 '재무제표감사', draft-standard-followup-20260913-s04 sub1 '전문가적 판단', pilot-01-006 sub1 '검토 중 식별된 사항', pilot-05-008 sub2 진술 주체의 범위, pilot-11-006 sub1 '변동이 있는 경우', std-points-20260914-2222be03fee2 sub1 '커뮤니케이션에서 식별된', std-points-20260914-a8c1931d1cec sub2 위험·통제활동의 성격이라는 이유)은 원문에 있는 조건·한정어·이유를 Luna가 엄격하게 요구한 것이고 명제는 원문과 일치한다. 부분정답 +1 한 건(draft-12-560-freq01 q2)과 오답 +1 세 건(pilot-08-004 sub2, pilot-11-004 sub2, pilot-12-005 sub1)은 Luna가 비슷한 표현을 너그럽게 인정한 것이며 명제·정답·출처에 오류가 없다.

v2의 오답 세 건과 v3의 오답 한 건은 기대 판정(not_met)과 Luna 판정(contradicted)이 달랐으나 둘 다 0점이다.

## 정본 설치와 생성물

- v1: `node --env-file=.env.local --import tsx cpa_uploader/correct_cpa_v3.ts publish <correction 179개> --efficient-review …/batch-v1.json --evidence …` — 세트 179개, 승급 장부 +358건. 학습 분류 입력은 `cpa_uploader/data/learning-question-classification-review.json`으로 새로 만들어졌다.
- v2: 같은 명령으로 `--efficient-review …/batch-v2.json` — 세트 5개, 승급 장부 +10건.
- v3: 같은 명령으로 `--efficient-review …/batch-v3.json` — 결과는 아래 검사 절에 적는다.
- coverage: v1 설치 뒤 [tools/update-coverage.mjs](tools/update-coverage.mjs)로 바뀐 물음을 가리키는 관계 58개를 재대조해 문항 해시와 이력을 갱신하고, KGA 600.40 재배치로 옮긴 한도기준 부분을 잇는 관계 2개를 새로 두었다. v2 대상 물음에는 관계가 없다. v3은 [tools/update-coverage-v3.mjs](tools/update-coverage-v3.mjs)로 s05 sub1 crit1의 관계 1개를 재대조했다. 이번 작업 전부터 stale이던 draft 범위 관계 94개(이 배치 세트에 걸린 27개 포함)는 초안 파일을 가리키며 이 배치의 변경과 무관하다.

## 운영 반영

운영 명령(inspect·probe·apply·verify)은 사용자가 터미널에서 실행했고, 로컬 준비(prepare)는 이 작업에서 실행했다. 도구는 `cpa_uploader/publish_question_release.ts`이며 기록은 `cpa_uploader/releases/<run>/`에 있다.

| 실행 | 결과 |
| --- | --- |
| `20260919-standard-spoiler` | inspect·prepare(평문 전송) 뒤 probe가 Management API 요청 크기 제한으로 거절됐다(HTTP 413, 본문 3,348,849바이트). 읽기 전용 단계라 운영 쓰기는 없었고 이 실행은 더 쓰지 않는다. |
| `20260919-standard-spoiler-compressed` | 도구에 압축 전송(`--transport compressed`)을 추가해 요청을 485,409바이트로 줄였다. probe 통과(payload·원문 해시 일치, 바뀌지 않은 세트 동일), apply 1회(service_role, 24.9초), verify 통과. |

- 운영 릴리스: `31504e78-cc30-48f0-bb09-4ae98caff453`(r05·r06 반영분, 369세트) → `c43c59e4-f074-4115-b816-a0a8218dd9d3`(369세트·547물음·1,873점, 원문 SHA-256 `55095861…`). 교체 181세트, 추가·삭제 0.
- 교체 세트: 이 배치의 180세트(v1 179, v3의 draft-standard-followup-20260913-s05; v2·v3의 나머지는 v1 세트와 겹침)와, 다른 세션이 2026-09-18에 로컬에만 게시한 pilot-01-005(사례형 종합문제 대체, [검토 배치](../pilot-01-005-comprehensive-2026-09-18/README.md)). pilot-01-005는 correction 경로가 아니어서 준비 기록에 정본 설치 기록 없음으로 표시되지만, 현재 내용 해시가 그 배치의 receipt·승급 장부와 같음을 확인했다.
- 검증: 운영 공개 문제은행이 정본 공개본과 같고, 물음 분류 547건이 정본 카탈로그와 같으며, 교체 세트만 새 버전이고 나머지 세트는 버전·위치가 같다. 첫 verify는 조회 함수를 읽기 전용 API 계정(`supabase_read_only_user`, 함수 실행 권한 없음)으로 불러 권한 오류로 멈췄다(기록 쓰기 전). 조회 함수를 read only transaction 안에서 service_role로 부르도록 도구를 고친 뒤 다시 실행해 통과했다.
- 운영 누적 릴리스 22개, 저장 원문 누적 108,492,548바이트([문항 수정 패치 운영](../../../../docs/문항-수정-패치-운영.md)의 남은 일 2).

## 확인하지 않은 범위

- agent 검토는 작성 agent가 직접 수행했다. 독립 agent 교차검토와 사람 확인은 하지 않았다.
- 운영 반영 후 앱 화면에서의 표시는 따로 확인하지 않았다(검증은 운영 DB의 공개본·분류·버전 왕복 대조).
- 이번 배치에 들지 않은 기준서형 물음(v1에서 수정 사항이 없다고 판단한 물음)은 이번에 새로 실측하지 않았다.
