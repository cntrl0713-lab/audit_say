# N04 분류 메타 후속 교정

총괄의 승인에 따라 T13-A `pilot-13-009`의 `classification.part`를 주제13 정본에 맞춰 `PART4`에서 `PART3`으로 수정했다. 수동 생성 원본 `build-package.mjs`도 동일하게 수정했다. 문항·답안·배점·공식출처·계획·QA 사례의 내용은 그대로다.

기존 초안·계획·QA·검사·인계·작성 원본36개를 [보존장부](preservation-manifest.json)의 `prior-part4/*.txt`에 원래 바이트와 SHA-256 그대로 보존했다. 확장자만 txt로 붙여 역사사본이 전역 인벤토리에서 활성 문항으로 다시 읽히지 않도록 했다. 기존 파일을 삭제하거나 원문과 과거 로그의 내용을 고치지 않았다.

[차이와 후속 증거](result.json)는 실제 내용 차이가 `classification.part` 한 항목뿐이며, T11-A/B와 모든 plan이 그대로이고 QA는 해당 초안 해시 메타만 바뀌었음을 확인한다. T13-A 새 SHA-256은 `fb4e12581a1f09e55fa974aefc2944346732de7dba289cdd20c5e9e790825c55`다. 현재 루트 `lineage.json`과 `handoff.md`는 새 해시를 가리킨다.

[후속 정적 검사](after-static-check.json), [후속 CLI](after-cli-validation.json), [전역 탐색·관계 검사](after-inventory-and-relations-check.json)는 오류0이다. 3세트·9물음·53점·QA214개를 유지했다. 준비용111+N04의400,000자 무호출 준비는298,449 /264,659 /319,790자다. 실제 의미검수·모델 채점은 여전히 미실행이며 최종49 비교은행 고정 후 재개한다.

전역 인벤토리에서 새 S02 관리장부도 내용 확인 후 제외목록에 추가했다. 실제 S02 문항 파일은 읽었으며 그 폴더에 쓰지 않았다. 이 후속 작업의 쓰기는 N04 전용 폴더에 한정했다.
