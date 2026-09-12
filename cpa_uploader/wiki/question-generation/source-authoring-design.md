---
title: 원자료에서 새 학습목표와 문제를 설계하기
created: 2026-09-09
updated: 2026-09-12
type: guide
status: reviewed
review_required: false
tags: [audit, question-generation, source-map, quality]
sources: [cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md, cpa_uploader/data/cpa_question_sets_v3.authoring.json, docs/plans/주제-01-03-검토에-따른-수정-결정.md]
confidence: high
---

# 원자료에서 새 학습목표와 문제를 설계하기

이 문서는 원자료를 고른 뒤 **학습목표 → 조건·예외 → 발문 → 답안 명제 → criterion → 공식 근거**를 설계하는 내부 제작 기록이다. 아래 서식을 채워도 문제의 정답이나 시험 적용 판본이 자동으로 승인되지 않는다. 새 초안은 `needs_review` / `needs_human_review`로 두고 [[question-generation-workflow]]의 검증·편입 절차를 따른다.

## 1. 원자료 단위에서 시작하기

연습·기출에 실제로 나왔던 요구를 찾으려면 [[question-elements]]의 구체 요구사항과 재수록 제거 빈도를 먼저 확인할 수 있다. 연결된 발문·공통지문·원자료 단위 ID를 읽고 아래 설계 절차에 사용한다. 추출된 요소는 정답이나 공식 근거를 대체하지 않는다.

[[source-catalog]]에서 주제와 원자료 단위를 찾고 연결된 파일의 실제 위치를 읽는다. 기준서 단위 외에도 기본이론·문제연습·기출의 원문 페이지를 탐색한다. 카탈로그의 단위는 원문을 찾기 위한 경계이며, 한 단위가 하나의 완전한 학습목표 또는 출제 가능한 문제라는 뜻은 아니다. 페이지 경계에서 사례·발문·해설이 끊겼으면 전후 페이지까지 확보한다.

[[requirement-coverage]]의 원자료 단위 연결과 기존 은행 인용을 대조한다. 연결이 없다는 사실은 미출제를 확정하지 않으며, 연결이 있어도 해당 목표·조건·예외가 이미 출제되었다는 뜻은 아니다. 기존 세트의 실제 발문·답안·criterion을 읽고 새 목표와의 차이를 기록한다. 문자 유사도 스캔에서 제외된 기준서와 비KGA 영역은 원문을 직접 확인한다.

공식 발췌의 주체·정의·본문·하위 항목·적용자료·예외를 함께 확보한다. 학습자료나 기출 답안은 적용 사례를 찾는 자료이며 공식 근거를 대체하지 않는다. [[source-review-map]]의 판본·법역·원문 확보 상태를 확인한다. 학습자료를 근거로 한 설계의 한계와 합의된 판본 가정은 `edition_assumption`에 기록하고, 목표의 정답·조건을 정하는 데 필요한 원문이 없으면 `unresolved_items`에 남겨 생성을 보류한다. 발표일, 보고기간 개시일, 시험 적용 판본을 구분한다. 2027년의 2026년 시행 기준 동일 적용은 기존 작업 가정이며 최종 시험 판본 확정이 아니다.

## 2. 두 가지 설계 경로

| 경로 | 출발점 | 설계 순서 | 보존할 기록 |
|---|---|---|---|
| `adapt_existing_question` | 원자료에 실제 사례·발문이 있음 | 발문만 먼저 읽고 요구 추출 → 당시 조건·답안 범위 기록 → 현재 목표·범위 결정 → 공식 근거 대조 → 새 발문·답안·criterion 대응 | 원래 발문 인용과 페이지, 바꾼 조건·범위, 원문과 새 문항의 차이 |
| `new_from_standard` | 기준서의 목적·정의·요구사항·예외에서 새 목표를 정함 | 원문과 의존 문단 확보 → 학습목표 한정 → 조건·예외 표 → 답해야 할 명제 결정 → 유형 선택 → 새 사례·발문 작성 → 답안·criterion 대응 | 원자료 단위 ID, 학습목표, 창작한 사례와 원문 근거의 구분, 기존 은행과 다른 점 |

재구성 경로의 첫 패스에서는 해설에만 있는 지식을 발문 요구로 끌어오지 않는다. 원문에 일부 선택·앞 N개 제한이 있으면 과거 요구로 기록하고, 현재는 **범위를 정한 모두 작성 발문**으로 설계한다. 원문 인용은 수정하지 않는다.

새 목표 경로에서는 기준서 문장을 이미 존재하는 발문처럼 취급하지 않는다. 감사인이 무엇을 구별·판단·설명·열거할 수 있어야 하는지 한 문장으로 정하고, 그 목표를 평가하는 새 발문을 만든다. 창작한 사실관계를 공식 원문 인용이나 실제 기출로 표시하지 않는다. 기존 질문의 표현만 바꾸는 것은 새로운 학습목표의 증거가 아니다.

## 3. 계획서 필수 항목

문항 JSON과 별도로 다음 `version: 1` 계획서를 저장한다. 비해당 항목도 빈 배열로 넘기지 않고 `해당 없음: 확인한 범위와 근거`를 적는다. 미확인과 비해당을 구분한다.

| 항목 | 계획서 필드 | 검토 기준 |
|---|---|---|
| 목표 | `objective` | 학습자가 보여야 할 이해·판단을 한정하며 단순한 주제명으로 대체하지 않음 |
| 경로·주제·유형 | `mode`, `topic_id`, `question_types` | 원자료 재구성/기준서 신규 목표를 구분하고 `descriptive`, `enumeration`, `judgment` 중 실제 요구에 맞게 선택 |
| 주체·시점 | `scope.actors`, `scope.timing` | 감사인/기업/지배기구, 수임 전/계속감사, 보고일/취합일 등을 섞지 않음 |
| 조건·예외 | `scope.conditions`, `scope.exceptions` | 그리고/또는, 의무/고려 가능, 부정, 임계값, 법역, 예외가 결론을 바꾸는지 확인 |
| 필수 답안 범위 | `scope.required_answers` | 명칭·정의·판단·근거·조치 중 실제로 요구할 항목을 열거하고 완전열거라면 전체 범위를 확보 |
| 제외 범위 | `scope.exclusions` | 묻지 않을 지식과 계산 요구를 명시하며 제외한 내용을 숨은 criterion으로 채점하지 않음 |
| 원자료·공식 근거 | `source_unit_ids` | 카탈로그의 실제 단위를 지정하고 파일·위치·해시·authority·edition·provenance 및 의존 문단을 대조; 학습자료만 있으면 공식 근거 공백 기록 |
| 기존 문제와 차이 | `existing_question_difference` | 비교한 세트·물음과 새 목표·조건·답안 범위의 차이; 인용 연결 없음만으로 신규성을 주장하지 않음 |
| 판본 가정·미확인 | `edition_assumption`, `unresolved_items` | 확인한 사실과 가정을 구분하고 공식 원문 부재, OCR, 문단 이동, 법역·시험 판본 미확인을 남김 |
| 작업 상태 | `status` | 처음은 `draft`; 사람이 필수 설계를 채우고 출제 범위를 막는 `unresolved_items`를 해소하면 `ready`. 이는 생성 입력 준비 상태이며 문제 검수·공식 판본·게시 승인 상태가 아님 |

### JSON sidecar 서식

아래는 빈 계획서의 형상 예시이며 출제 가능한 완성 계획이 아니다. 원자료 ID를 실제 카탈로그에서 선택하고 각 자리표시자를 근거 있는 내용으로 채운다. 실제 생성 입력은 현재 계획서 검증기를 통과해야 한다.

```json
{
  "version": 1,
  "topic_id": "13",
  "mode": "new_from_standard",
  "objective": "",
  "scope": {
    "actors": [],
    "timing": [],
    "conditions": [],
    "exceptions": [],
    "required_answers": [],
    "exclusions": []
  },
  "question_types": ["descriptive"],
  "source_unit_ids": ["<실제 카탈로그 단위 ID>"],
  "existing_question_difference": "",
  "edition_assumption": "2027년의 2026년 시행 기준 동일 적용은 작업 가정이며 시험 적용 판본은 별도 확인",
  "unresolved_items": ["공식 판본과 의존 문단을 확인하고 구체적인 미확인 사항으로 교체"],
  "status": "draft"
}
```

### 현재 CLI로 계획 준비하기

저장소 루트에서 다음 순서로 실행한다. 아래 명령은 사용법이며 이 문서 작성 과정에서 실제 모델을 호출하거나 문제를 출제한 기록이 아니다. `--source`의 ID는 목록의 실제 값으로 교체한다.

```sh
npx tsx cpa_uploader/generate_cpa_v3.ts --list-sources --topic 13
npx tsx cpa_uploader/generate_cpa_v3.ts --prepare-plan plan.json --topic 13 --source UNIT_ID
```

필요한 원자료 단위가 여럿이면 `--source UNIT_ID`를 반복한다. 생성된 `draft` 계획서에서 목표·범위·기존 차이·판본 근거를 채운다. 출제 범위를 막는 미확인 항목을 해소한 뒤 `unresolved_items: []`, `status: "ready"`로 기록한다. 이미 합의된 시험 판본 가정은 `edition_assumption`에 남긴다. 학습자료를 선택한 계획도 준비할 수 있지만, 공식 근거 대조 필요가 사라지는 것은 아니다.

```sh
npx tsx cpa_uploader/generate_cpa_v3.ts --plan plan.json --output draft.json
```

마지막 명령은 모델을 호출하는 생성 단계다. 계획 검증과 실제 원자료 패킷의 의존 문단 검사를 통과해야 진행한다. 의존 근거가 미확보된 경우 생성을 멈추고 원문을 확보하거나 목표 범위를 다시 설계한다. 범위를 바꿨다면 차이와 제외 근거를 계획서에 남긴다.

생성기는 `<draft>.authoring-plan.json`과 `<draft>.source-packet.json`을 함께 기록한다. 각 산출물의 `set_id` 연결을 보존하고 의미검수에 전달한다. 생성 중간의 체크포인트와 성공한 최종 초안을 구분한다.

## 4. 발문·답안·criterion 대응표

계획서의 필수 답안 범위를 다음 표로 펼친다. 물음이 둘 이상이면 표를 물음별로 나눈다. 이 표는 내부 설계 기록이며 공개 발문에 criterion ID나 채점 구현 설명을 넣지 않는다.

| 학습목표 | 발문에서 명시한 요구 | 조건·예외 | 모범답안 명제 | criterion·정수 배점 | 공식 단위·문단 | 미확인 사항 |
|---|---|---|---|---|---|---|
| 실제 목표 | 명칭/정의/판단/근거/조치 중 요구한 것 | 결론을 바꾸는 전제 | 한 번만 배점할 독립 명제 | 기본 1점, 충족/미충족/반대의 기대값 | 실제 카탈로그 ID와 공식 위치 | 확인 전에는 해소된 것으로 표시하지 않음 |

열거형은 답안 개수 제한 대신 발문 범위를 명확히 한다. `selection={type:"all",n:null}`, `constraints={ordered:false,max_entries:null,overflow_policy:"none"}`를 사용하고, 일부 독립 criterion만 충족한 정수 점수는 유지한다. 의미상 선후관계는 답안·criterion에 보존한다. 판단과 근거를 분리 채점할지 결합할지 표에 밝힌다.

모범답안이 모든 criterion을 충족하는지, 모든 criterion이 발문에 드러나는지 양방향으로 확인한다. 같은 사실을 표현만 바꿔 중복 배점하지 않는다. 원문 인용의 실존·구조 검증과 명제의 의미 검증은 별개다. 완전 정답, 동의 표현, 한 명제 누락, 반대 의미, 빈 답안의 기대값을 원문과 계약에서 먼저 정한 뒤 검증한다.

## 5. 원자료 경계를 점검할 표본

- 주제01·05: [[source-review-map]]과 기준대장의 공식 파일 확보 상태를 확인한다. 통합학습자료 fallback을 공식 원문 확인으로 바꾸지 않는다. 확인할 수 없는 판본·문단은 계획서에 남긴다.
- 주제13: KGA402의 직접 은행 연결이 없어도 원자료의 서비스조직 사례·기출은 탐색할 수 있다. 610·620 문제 수로 402 목표의 충족을 추정하지 말고 [[topic-13-design]]과 원문에서 범위를 정한다.
- 주제18: 완전열거를 묻는다면 [[topic-18-design]]의 범위 확인을 거쳐 본문과 하위 항목 전체를 확보한다. 짧은 요약이나 한 페이지 단위만으로 완전성을 확정하지 않는다.
- 주제19: [[topic-19-design]]에서 국내 기준과 ISA 비교자료의 역할을 구분한다. 외국 기준의 발췌·문구 존재를 국내 적용 확인으로 기록하지 않는다.

## 6. 의미검수·실제 사례 채점·사람 검수 근거

현재 기본 검증·승급 경로는 [공통 비용 통제 계약](../../../.agents/skills/audit-question-review/references/cost-controlled-verification.md)을 따른다. agent가 전수 내용·출처·배점을 대조한 뒤 실제 Luna 대표 채점을 수행하고, `--efficient-review` 증거로 별도 승급한다. 아래 명령과 criterion별 전수 API·수동 receipt 설명은 **기준별 전수검사 경로를 선택했을 때** 적용한다. 기존 receipt의 수락 계약을 바꾸거나 agent 확인을 사람의 직접 검수로 표시하지 않는다.

`npx tsx cpa_uploader/validate_draft_v3.ts --file draft.json --against-bank`로 편입 전 형상·원문 인용·ID 및 동일 발문 중복을 확인한다. 다음 명령은 draft와 계획·패킷·실제 출처 파일·비교 은행을 읽어 의미검수하고, 실제 사례 채점까지 실행해 receipt를 기록한다. 생성 sidecar는 draft 옆에서 자동으로 찾으며 별도 입력에는 `--plan`, `--packet`, `--bank`를 지정한다.

```sh
npx tsx --env-file=.env.local cpa_uploader/review_question_draft_v3.ts --file draft.json --grade-cases --output review.json
```

의미검수 모델은 `OPENAI_API_KEY`와 `CPA_REVIEW_MODEL` 또는 `CPA_GENERATION_MODEL` 설정이 필요하다. 모든 물음·criterion에 발문/정답 대응·원문 지지·조건/예외·판본/범위·의미 중복의 다섯 검토사항을 기록하고, criterion마다 모범답안·허용 표현·명제 누락·반대 의미·조건 경계의 다섯 사례와 draft/source 실인용·근거를 작성한다. `--grade-cases`는 이어서 `CPA_GRADING_MODEL` 설정을 따르는 실제 채점 API를 호출한다. 채점 모델 미설정 시 기존 채점 코드의 기본 모델을 사용한다.

의미 대조를 수동으로 작성하고 실제 사례 채점은 후속 실행하는 경로는 다음과 같다. 처음 두 명령은 모델을 호출하지 않고, 마지막 명령은 채점 API를 호출한다.

```sh
npx tsx cpa_uploader/review_question_draft_v3.ts --file draft.json --manual-template --output review-template.json
npx tsx cpa_uploader/review_question_draft_v3.ts --file draft.json --manual-input review-template.json --description "실제 검토자·대조 자료·확인 방법" --output semantic-review.json
npx tsx --env-file=.env.local cpa_uploader/review_question_draft_v3.ts --file draft.json --review-input semantic-review.json --grade-cases --output review.json
```

양식 생성과 수동 확정 사이에 사람이 모든 단위·사례·인용·판정 근거를 채운다. 미완성 양식은 uncertain이며 `--manual-template`과 `--grade-cases`를 함께 쓸 수 없다. 수동 확정 명령에 `--grade-cases`를 붙여 같은 실행에서 채점할 수도 있다. 모델로 의미검수만 먼저 했다면 같은 `--review-input` 후속 경로를 쓴다. 입력 receipt와 출력은 다른 파일이어야 한다.

의미검수만 pass이면 `grading.status=not_run`이며 신규 검수 승급이 차단된다. 실제 채점은 criterion별 다섯 사례와 전 물음 빈 답안을 실행한다. 동일 답안은 한 번 실행하되 연결된 기대 판정을 모두 대조하며, 빈 답안은 모델 호출 없이 0점인지 확인한다. 원래 판정과 인용·보안 검증 후 결과, 기대 판정과의 일치, 사례·채점 코드 해시를 기록한다. `grading.status=completed`에 더해 기록 점수의 실제 코드 재현과 모든 기대 판정의 일치가 필요하다. 테스트용 주입 응답은 transport로 구분하며 외부 모델 품질 실측으로 취급하지 않는다.

이 통과도 정답·판본의 정확성 보증은 아니다. 사람이 공식 근거·판본·예외·기대 판정을 확인하고 검수 근거를 남긴다. fail·uncertain·실제 채점 불일치를 해소하거나 검수 대상·원문·비교 은행·배치가 바뀌면 필요한 의미검수를 다시 수행한다. 사례나 채점 코드가 달라졌다면 실제 사례 채점도 재실행한다.

정본 편입·검증 후 `promote_cpa_v3.ts --to verified --sets <ID> --review review.json --evidence "실제 사람 검수 근거"`로 승급한다. 신규 승급·재검수에는 의미검수와 실제 사례 채점·점수 재현 검증을 통과한 receipt가 필요하다. 기존 무해시 소급 장부는 과거 내용 변경의 자동 탐지를 보장하지 않는다. 게시·배포 명령은 [[question-generation-workflow]] 및 [파이프라인 README](../../README.md)를 따른다.

## Related

- [[question-elements]]
- [[source-catalog]]
- [[requirement-coverage]]
- [[question-generation-workflow]]
- [[question-output-schema]]


## 7. 채점 오류와 분할 검수의 처리

채점 오류·인용·보안·원시 기록의 보존 원칙은 두 검증 경로에 공통으로 적용한다. 이 절의 criterion별 분할 모델 의미검수와 `execution.transport`·`grading.transport`를 갖춘 기존 receipt의 신규 수락 요건은 **기준별 전수검사 경로에 한정**한다. 비용 통제 경로는 [공통 계약](../../../.agents/skills/audit-question-review/references/cost-controlled-verification.md)의 agent 내용 검토·실제 대표 채점·별도 재사용 및 승급 증거를 따르며, 기반 자료·모범답안·배점·QA 기대값의 미해결 오류는 어느 경로에서도 허용하지 않는다.

실제 채점 응답은 답안의 원문 구간 ID를 선택한다. 서버가 해당 답안의 원문으로 인용을 복원하며, 다른 물음의 ID·없는 ID·판정 누락·허용하지 않은 부분점수는 응답 오류다. 형식·근거 오류는 제한된 재시도 후에도 남으면 채점 서비스 오류로 반환하고 학생 점수로 확정하지 않는다. 전송 실패도 점수로 바꾸지 않는다. 전체 빈 답안은 기존처럼 모델 없이 0점 처리한다.

보안 의심은 실제 답안 근거와 독립 재확인을 요구한다. 감사인의 판단이나 경영진의 조치를 설명한 오답은 채점자에 대한 조작 지시와 구분한다. 확인된 공격은 해당 물음에만 적용하며 불확실하면 채점을 확정하지 않는다. 기존 세트 전체 보안 플래그와 물음별 보안 플래그의 범위는 유지한다.

의미검수는 물음·criterion별로 요청을 나눈다. 비교 은행과 원문 문맥은 유지하고, 모델이 선택한 필드·출처 ID를 실제 문자열로 연결한 뒤 전체 필드·출처·5종 사례를 다시 검사한다. 사례의 pass는 답안의 정답 여부가 아니라 기대 판정의 타당성이다. CLI는 `<output>.chunks.jsonl`에 의미검수 중간 응답과 실패를 보존하고, `<output>.grading.jsonl`에는 각 실제 채점의 성공·불일치·실패와 원시 응답을 즉시 기록한다. 중간 실패의 부분 로그는 완료 receipt가 아니다. 기존 로그가 있으면 새 출력 이름을 사용한다. 분할 응답이 모두 유효해도 의미상 fail·uncertain은 승급을 차단한다.

현재 코드로 새 검수를 수락할 때는 사례·채점 코드·모델의 일치를 요구한다. 과거 승인 기록 조회에서는 당시 코드 해시를 보존하면서 내용·사례·기록 무결성과 점수 재현을 검사한다. 과거 기록의 보존 통과를 현재 모델 품질의 재검증으로 표시하지 않는다.


### 검수 증거의 경계

모델 의미검수의 `execution.transport`와 사례 채점의 `grading.transport`를 각각 기록한다. 신규 수락·승급은 두 값 모두 `model`이어야 하며, 실제 수동 의미검수는 별도 실행 방법·근거 계약을 따른다. 주입 응답이나 transport 미기록 모델 의미검수에 실제 채점만 추가해 신규 수락하지 않는다. 과거 기록은 누락 필드·당시 실행 종류를 그대로 보존하고 새 수락이 필요하면 실제 의미검수를 새로 수행한다.

정상 검수 사례에서 세트 또는 물음별 보안 플래그가 있으면 기대 0점과 같더라도 일치로 보지 않는다. 모델 요청의 일시적 전송·SDK 연결/시간초과·빈 응답·JSON 오류도 제한 재시도와 오류 기록의 대상이며, 인증·설정·거절·출력 한도·사용자 중단은 동일 요청을 반복하지 않는다. 기록용 콜백에는 독립 스냅샷을 전달하고, 기록 실패로 모델을 재호출하거나 판정·점수를 바꾸지 않는다. CLI는 기존 최종 출력과 중간 로그를 덮어쓰지 않으므로 새 출력 경로를 사용한다.

사례 문구 교체 시 원답안을 전체 문맥과 원자료로 다시 판단한다. 유효한 원답안은 교체답안과 함께 회귀 대상으로 남기며, 불완전 원답안의 과대채점도 별도로 확인한다. 안정적으로 통과하는 문장으로 바꿨다는 이유만으로 원 사례의 실패를 해결 처리하지 않는다. AI가 수행한 의미 대조와 실제 사람 확인은 구분한다.
