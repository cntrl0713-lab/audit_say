# Validation worker v2

`validation-worker-v2.mjs`를 새로 작성했다. v1과 공통 코드는 수정하지 않았다. SHA256은 `badd0b431e8bcb92bc34724a691600b56ed20de9fde26f69a1b253d08325dbf7`이다.

grading job의 `semantic_provenance`에 원 manifest 경로·해시, 원 worker, run directory, receipt 경로·해시를 지정할 수 있다. 원 manifest와 run/request/summary/receipt를 서로 결속하고 실제 model transport, 완료 상태, 입력·계획·출처·은행·전체 원 runtime 코드의 동일성을 확인한다. 원 worker와 현재 grading worker는 달라도 된다. 원 worker 파일을 포함한 모든 원 runtime 항목은 현재 manifest에 같은 해시로 남아 있어야 한다. 원 코드 변경을 허용하는 예외는 없다.

`run_sha256`, `summary_sha256`, `request_sha256`는 선택적으로 추가 고정할 수 있다. 미지정이어도 각 파일의 내용과 결속을 검증하고, 읽은 해시를 실행 전에 고정하여 새 request 기록에 남긴다. receipt와 연결 파일의 실제 경로는 원 run 밖으로 나갈 수 없다. 실제 채점은 기존 production CLI에 `--review-input`을 넘기며 CLI 자체 검증을 우회하지 않는다. 기존 `--semantic-directory` fallback도 유지했다.

`--stop-file`이 있으면 다음 세트를 시작하지 않는다. 현재 CLI는 정상 완료시킨 뒤 `gracefully_stopped`와 미착수 ID를 기록한다. 마지막 spawn 직전에도 확인한다. 중지 파일과 별개로 실행 파일·고정 입력 변경 또는 신호는 기존처럼 현재 자식 프로세스를 즉시 중단한다. 기존 파일 덮어쓰기는 허용하지 않는다.

Node syntax, 대상 ESLint, 임시 fixture 14개가 통과했다. fixture worker 실행 12회와 로컬 dummy 자식 1회를 사용했고 API 및 production CLI 호출은 0회다. 합성 receipt는 출처 결속 검사용이며 실제 검수·채점 통과 근거가 아니다. 상세 결과는 `validation-worker-v2-checks.json`에 있다.

예시: `node --env-file=.env.local <worker-v2> --manifest <manifest> --worker b --phase grading --output <새 경로> --stop-file <중지 파일>`을 사용한다. 먼저 같은 인자에 `--dry-run`을 붙여 무호출 점검할 수 있다. grading/review 모델 환경변수는 manifest 값과 명시적으로 일치해야 한다.
