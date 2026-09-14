# 사례형 전수 품질 검토 — 2026-09-13

대상은 작업 시작 시 편집 정본에 게시되어 있던 **41개 사례 부모의 72물음**이다. 과거 초안은 출처·계보 자료이며 현행 전수 범위에 중복 집계하지 않는다. 사용자는 수정·실제 검증을 거쳐 정본·공개본과 운영 DB까지 반영하도록 승인했다. [대화 승인 기록](authorization.md).

## 수동 입력과 검토 근거

- `bank-before.json`, `catalog-before.json`, `classification-before.json`, `baseline.json`: 시작 시점 원본과 대상 ID·해시. 덮어쓰지 않는다.
- `decisions.mjs`: 72물음 모두의 사실 활용·요구량·배점 유지/분리 이유. 글자 수나 배점 상한으로 판정하지 않았다.
- `revise.mjs`: 사실 보완·미사용 상황 제거·요구 분리·재분류의 편집 입력. 현재 승인된 수정 범위를 재현한다.
- `audit-v1.json`: 전수 장부. 물음별 원 기준, 원 답안, 수정 이유, 최소 충분 답안, 기준의 이동처와 정수 배점을 기록한다.
- `lineage-v1.json`: 12개 원 물음의 요구 분리·재배치. 이전 criterion을 삭제·재번호화하지 않는다.
- `source-evidence-v1.json`: 실제 읽은 고유 원문 발췌 145개와 파일·위치. 원출처·판본은 등록 원자료 및 raw 수집 계보를 이어받았다. 이번 수정은 새로운 법규 판본의 적용 판단을 추가하지 않았다.
- `qa-overrides.mjs`: 분리된 요구에 맞춰 직접 정한 대표 부분정답·오답. 기존 답안은 `qa-candidates-v1.json`의 원 manifest·선택 근거로 추적한다.
- `within-tolerance-review.json`: 5개의 1점 편차에 대한 원문·기대점수 재대조. 점수를 맞추기 위한 추가 호출은 하지 않았다.

## 생성 결과와 실측

`candidate-v1.json`, `classification-v1.json`, `catalog-v1.json`은 편집 입력에서 만든 후속 검증본이다. 현재 정본과 별도이며 그 자체로 게시 완료를 뜻하지 않는다. `execution-v1/` 생성 후의 입력·코드·원답안·기대값·API 응답은 고정해 보존한다.

`execution-v1/`의 33개 저장 묶음·99물음은 원 사례를 수정한 32묶음과 기준서형으로 분리한 1묶음이다. 동일 부모의 채점 입력이 달라지므로 해당 묶음의 일반론 물음도 함께 검증한다. 원래 사례 72물음 중 42물음은 발문·정답 또는 부모 사실이 바뀌었고 30물음은 유지했다. 변경 없는 9개 사례 부모의 기존 검수·채점 증거는 유지한다.

Luna 대표 답안 294개: 점수 일치 289개, ±1점 범위 294개. 실제 SDK 호출 231회에는 기록된 형식/전송 재시도 1회가 포함된다. 응답의 토큰·모델·요청 식별자·비용 계산은 각 `actual-*/<entry>/`와 `summary.json`에 보존한다. [봉인 결과](sealed-v1/summary.json), [공통 검증 수락](sealed-v1/readiness.json).

정수 점수 기준의 관측 일관성만을 의미하며, 모든 가능한 답안의 정확도나 통계적 신뢰수준을 주장하지 않는다. agent가 원문을 읽은 검수, Luna 실제 채점, 사람 확인은 별개다. 별도 유료 모델 의미검수와 사람 대리 확인은 없다.

## 게시와 운영 근거

- `publication-v1/`: 원 정본·승급 장부·공개본·암호화본·분류의 백업, 격리 승급/컴파일, 정본 설치와 각 단계 로그. 과거 장부의 앞부분을 보존하고 새 검수·게시 항목만 추가한다.
- `db-private-metadata-v1/`: 전일 준비된 비공개 조회 복원 SQL의 새 사전 확인·트랜잭션 영수증. 이전 실행의 중지 기록은 변경하지 않았다. 복원 후 봉인된 256개 판본의 비공개 DTO와 실제 채점 payload·외부 지시문을 원문과 대조했다. 처음 검사 도구의 읽기 역할·과거 max_entries 비교 오류는 별도 진단 기록에 남겼고 원 데이터는 수정하지 않았다.
- `db-publication-v1/`: 이번 수정본의 운영 입력 및 독립 사후 검증 근거. 활성 릴리스 `43c54ea0-bd5f-4f10-80e5-70dc3d49a841`의 공개·비공개 155묶음, 분류 364물음, 학습 단위 329개가 검증본과 일치했다. 최종 상태는 `completion.json`의 `production_published_and_independently_verified`이다.
- `coverage-links-before.json`, `coverage-update.json`: 분리된 상황 나의 criterion 연결을 새 물음으로 이어 준 기록. 과거 후보 관계를 검수 완료로 올리지 않았다.

최종 상태는 각 완료 영수증과 [사람용 보고서](../../../../docs/reports/case-quality-review-2026-09-13.md)에서 확인한다. 로컬 게시나 파일 존재만으로 운영 반영을 추정하지 않는다.

## 후속 확인: 짧은 사례와 한 물음 사례

`case-shape-followup.mjs`와 `case-shape-followup-v1.json`은 게시 후 사용자의 추가 질문에 대한 별도 읽기 전용 조사다. 운영 릴리스의 정본 해시를 다시 확인했으며, 41개 사례 중 한 물음 사례 19개, 공백 포함 200자 이하 사례 6개를 확인했다. 그 6개는 모두 한 물음이다. 19개 사례의 지문·발문·답안을 다시 읽은 결과는 [후속 보고서](../../../../docs/reports/case-length-and-question-count-2026-09-13.md)에 기록했다. 기존 검수·게시 영수증과 문제 내용은 바꾸지 않았다.

## 실행·재현

검토 입력을 편집할 때는 새 버전의 출력 경로를 사용한다. 이미 봉인된 `execution-v1`, `sealed-v1`, 게시·DB 영수증을 덮어쓰지 않는다.

```text
node revise.mjs
npx tsx scripts/build-learning-unit-catalog.ts --review <classification> --output <catalog>
node --import tsx build-execution.mjs
npx tsx --env-file=.env.local <기존 run-efficient-grading.ts> --manifest <manifest> --manifest-sha256 <SHA> --worker a|b|c --output <새 경로> --stop-file <STOP>
node --import tsx seal.mjs
node --env-file=.env.local --import tsx publish.mjs --stage
node --env-file=.env.local --import tsx publish.mjs --install
node --env-file=.env.local --import tsx deploy.mjs
```

위 편집·조립 스크립트 경로는 이 폴더 기준이고 실행 cwd는 저장소 루트다. 실제 호출 당시 조립 스크립트는 `execution-v1/build-execution.ts.txt`에 보존했다. 이후 같은 본문을 `.mjs`로 정리한 것은 실행 증거 변경이 아니다. 코드 보존 사본은 앱의 타입검사 입력에서 제외하며 실제 런타임 원본은 계속 검사한다.

모델 응답의 동일 재현은 보장하지 않는다. 운영 DB 반영은 실제 연결 설정과 사용자의 승인 범위가 필요하다. 키·토큰·사용자 제출 원문은 이 폴더에 저장하지 않는다.
