# 효율 검증 실행기: API 미실행 인계

이 폴더는 새 검증의 실행 도구다. 119세트의 내용 정확성, 실제 모델 채점 또는 운영 DB 반영을 완료했다는 기록이 아니다. 현재 실제 API 호출은 0회이며 최종 은행·대표 사례·공통 코드의 새 잠금 이후에만 실행한다.

## 확정한 형상과 실행

[`contract.ts`](contract.ts)가 manifest/observation 형상의 기준이다. `evaluated_subquestion_ids`는 대표 답안을 평가하는 물음만 명시한다. 사례형은 부모 사실과 모든 사례형 물음을 투영하고, 평가하지 않는 물음에는 빈 답안과 전체 criterion `not_met`/0 기대값을 남긴다. 이 물음은 95% 목표의 분모에서 제외한다. 기준서형은 실제 앱과 동일하게 독립 발문·사실 없는 단일 물음으로 투영한다.

모범답안은 `model_answer.join('\n')` 그대로이며 별도 학습 모범답안 시험을 중복 호출하지 않는다. 부분·오답은 지정된 원 QA의 답안/기대점수/전체 criterion 기대값과 완전히 같아야 한다. 같은 물음·유형을 다시 선택하거나 요청 prompt/schema가 완전히 같은 별도 실행 항목을 넣으면 준비 단계에서 거절한다. 전체 범위의 대표 유형 충족 여부와 실제 agent 내용검토의 결속은 총괄 manifest 및 승급 검증에서 확인한다.

```powershell
$env:CPA_GRADING_MODEL='gpt-5.6-luna'
node --env-file=.env.local cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/b/run-efficient-grading.ts --manifest <새-manifest.json> --manifest-sha256 <고정-SHA256> --worker b --output <미사용-출력폴더> --stop-file <공유-STOP> --dry-run
```

실제 실행은 `--dry-run`을 빼되 dry-run 출력과 다른 새 폴더를 쓴다. 프로세스 하나는 한 스트림이며 총괄이 최대 3개 프로세스를 관리한다. 기존 production 요청/스키마/채점은 그대로 사용하고 품질 불일치에 대한 추가 반복은 없다. production의 기존 2회 프로토콜 시도는 유지하며 각 실제 SDK 요청을 모두 기록한다. 429/잔액 오류는 상위 transport 문구보다 먼저 찾아 공유 STOP을 만들고 즉시 후속 호출을 막는다. 다른 실행 오류도 점수 실패로 변환하지 않고 해당 작업을 중단한다.

원시 보안 의심과 최종 보안 오류는 ±1점 허용으로 수락하지 않는다. `strict_matched`와 `within_tolerance`를 별도로 저장한다. 내용·정답·원문·기대표 오류는 허용하지 않는다. 관측된 물음×유형 비율과 전체 예정 범위 완료는 별도로 판단해야 하며 95%는 통계적 신뢰구간이 아니다.

## 출력과 재사용 경계

- `preflight.json`: manifest SHA, 모든 입력/출처/코드 SHA, 대상 entry IDs, 사후 비용 계산 정책.
- `<entry>/input.json`: `{entry,set,prompt,schema,model}`.
- `transport.jsonl`: 실제 `request_started {sequence,params}` / `response_received {response}` / `request_error {error}`. API 키를 쓰지 않는다.
- `traces.jsonl`: production `GradingTraceV3` 원형. `usage.jsonl`: `{provider,cost}`.
- `observation.json`: 원답안·전체 기대표, 실제 raw/grounded judgment/traces/result, 재합산 동일성, 원 엄격 판정·물음별 편차·보안 판정, 원파일 SHA.
- `execution-error.json`: 부분 원시 기록을 유지하고 `scored:false`. 미완료를 정상 채점으로 만들지 않는다.
- `summary.json`: 완료/중단·잔여 IDs·실제 SDK 수·실측한 대표 답안 수·허용 범위 비율·사용량·사후 금액.

과거 producer의 임의 receipt를 이 실행기가 자동으로 가져오지는 않는다. 기존 실제 응답을 재사용하려면 원 요청 prompt/schema/instructions/model과 현재 학습 투영, 실제 provider 원시·보안·판정·재합산·계보의 동등성을 별도 검증해야 한다. 동일성을 확인한 과거 증거는 총괄의 명시적 선택 장부로 연결하며 원 receipt를 다시 쓰지 않는다. 이 폴더의 synthetic fixture는 실제 모델 증거가 아니다.

## 사용량·비용

OpenAI Docs와 로컬 SDK 7.10의 ResponseUsage 계약을 대조했다. [Luna 모델](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [공식 가격표](https://developers.openai.com/api/docs/pricing), [Responses API](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create)를 2026-09-12에 확인했다.

사용자가 provider에 설정한 20달러 한도를 사용한다. 사전 비용 추정을 위한 모델 호출·토크나이저·예약 계산은 없다. 응답의 실제 model/service_tier와 표준 OpenAI endpoint가 확인될 때 실제 input/cache read/cache write/output 수에 고정 요율을 곱한다. reasoning 토큰은 output에 포함되어 있으므로 이중 합산하지 않는다. 272,000 초과 input은 전체 요청의 장문 요율을 적용한다. 확인되지 않는 tier/usage/endpoint의 비용은 `null`, cache write만 누락되면 가능한 사후 금액 범위로 남긴다. 반환 usage 없는 실패 요청은 무료라고 단정하지 않는다. 계산액은 청구서·세금·개별 계정 할인을 확정한 금액이 아니다.

`lib/ai/openaiStructured.ts`의 optional `onUsage`/`withOpenAIUsageObserver`는 provider 메타데이터만 읽는다. 반환 응답의 usage는 거절·출력 잘림·JSON 오류라도 기록한다. 관측자는 독립 복사본을 받고, 저장 실패는 모델 재호출로 복구하지 않는다. 기존 동결 runtime과 변경 전 소스는 [`before/`](before/)에 보존했다.

## 로컬 검사

- 기존 production 채점 경로 포함 48개 테스트 통과, TypeScript 및 대상 lint 통과.
- 변경 전/후/사용량 관측자 활성화 요청의 params·options·결과/오류·호출 수를 6상황에서 대조: [`telemetry-proof-gB1Jjz/report.json`](telemetry-proof-gB1Jjz/report.json).
- 실제 현재 source/projection 기반 준비·빈답안 API0·dry-run·사례 전체+문맥용 빈답안 fixture: [`local-fixture-4GDJjF/`](local-fixture-4GDJjF/). 이는 내용 검수 승인이 아니다.
- 초기 fixture의 전체 metadata 전달 오류와 테스트 SHA 오타는 API 호출 전 발견·수정했으며 초기 폴더도 보존했다.
