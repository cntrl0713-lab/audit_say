# 출처 범위 표지 후속 독립 확인

검사한 core SHA-256은 `89aada95959c742054a7d415959049dbb652c154567146887868f4796ecd76f9`이다. 이전 독립 보고서·실패 증거는 보존했다. 원 장부의 `pilot-09-008` receipt를 바꾸지 않고 다시 읽었으며, 반례는 메모리 복제본에서만 만들었다. API 호출과 core·은행·장부 쓰기는 0이다.

11개 확인이 모두 통과했다.

- 실제 09-008의 표지 없는 과거 receipt 읽기가 복원됐다. 원 104세트 전체 장부와 미수정 34세트 장부도 오류 0개다.
- 같은 과거 입력을 신규 수락 경로에 전달하면 여전히 보충 출처 `src50515head` 누락을 거부한다.
- 메모리 복제본에 새 표지를 붙이고 그 복제본 해시를 다시 계산해도 보충 출처가 없는 신판 기록은 거부한다. 따라서 오류가 단순 해시 불일치 때문에 가려진 것이 아니다.
- 표지만 바꾸고 해시를 갱신하지 않은 복제본은 receipt hash 불일치로 거부한다.
- 과거 호환 경로에서도 criterion의 보충 출처를 제거하면 거부한다. 원문 파일 해시나 source metadata를 바꾼 뒤 복제본 receipt 해시를 다시 계산해도 현재 원문·metadata 대조에서 거부한다.
- 새 `completeSemanticReview`와 수동 template은 `requirements_and_criteria_v1` 표지를 자동 기록한다. 이 확인에 쓴 완성본은 격리 fixture이며 실제 의미검수·사람 승인 기록으로 저장하지 않았다.

호환 처리는 `validateReceipt`의 `checkCurrentBank=false`이면서 표지 없는 기록에만 한정된다. `prepareSemanticReview`는 합집합을 계속 생성하며 공개 legacy 옵션이 추가되지 않았다. 강화된 신규 수락을 낮추는 별도 결함은 발견하지 못했다. 이 결과는 버전·형상·출처 계약의 로컬 검증이며 모델의 실제 판단 정확성을 뜻하지 않는다.

구체 판정·원시 오류 목록·입력 해시는 `semantic-clarification-marker-followup-evidence.json`, 검사 코드는 `semantic-clarification-marker-followup.ts`에 있다. 검사 중 읽은 입력 해시는 모두 그대로였다.
