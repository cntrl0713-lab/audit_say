# 의미검수 입력 보완 독립 검토

검사 당시 `questionSemanticReview.ts` SHA-256은 `f7d06c5bc03a441f2286c1cc07ac82f369158df6801c50ab8882380f381e8e7a`이다. 정확한 변경 전 snapshot은 `c97d55204c90be46162cd55504c8231a9c5ff2f06b21898e2aa95c3307aa3a17`이다. 변경 전 코드를 메모리에서만 컴파일하여 현재 코드와 실제 원 장부를 비교했다. API 호출·원격 접근·core/은행/장부 수정은 모두 0이다.

## 확인된 호환성 문제 1건

`validateRecordedSemanticReview`도 현재 `prepareSemanticReview`의 예상 단위를 사용한다. 따라서 물음 sources를 requirement와 criterion의 합집합으로 강화하면, 과거에는 criterion 단위에서만 검토했던 보충 출처를 과거 물음 단위의 필수 인용으로 소급 요구한다.

실제 `pilot-09-008`의 과거 verified receipt는 변경 전 오류 0개에서 변경 후 `subquestion:sub2: source src50515head에 연결된 전체 근거 인용 누락` 1개로 바뀐다. 이는 receipt 내용·해시·판정이 바뀌어서가 아니다. 같은 원 104세트의 장부 검증도 이 오류 1개만 반환했다. 새 강화 기준을 유지하면서 당시 기록을 읽는 별도 호환 처리가 필요하다.

권고는 `execution.source_coverage?: 'requirements_and_criteria_v1'`과 같은 선택적 버전 표지이다. 새 complete/template 경로에서 자동 부여하여 receipt 해시에 묶고, 신규 수락·사례 채점은 항상 합집합을 요구한다. `checkCurrentBank=false`인 과거 읽기에서 표지 없는 receipt의 subquestion 예상 sources만 당시 requirements 집합으로 복원한다. criterion 출처·내용·원문 파일·메타데이터·receipt hash 검증은 유지한다. 공개된 prepare 옵션으로 신규 수락까지 구범위로 낮추지 않는다. 표지를 소급 삽입하거나 과거 해시·판정을 바꾸지 않는다.

미수정 34세트·70물음에는 위 문제가 없다. criterion-only 출처가 있는 08-003·08-004·09-006·12-003·16-006은 소급 장부만 있으며 semantic receipt를 가지고 있지 않다. 실제 receipt가 있는 13-007·13-008은 물음 출처의 합집합이 이전 집합과 같다. 34세트 전체 `validatePromotionLedger(..., true)`는 오류 0개였다. 실제 기존 receipt 8개 중 나머지 7개는 변경 전후 모두 통과했다.

## 나머지 변경 확인

- 보충 출처: 실제 criterion-only 출처를 추가한 격리 메모리 fixture에서 물음의 예상 sources와 `reference_catalog.sources` 및 `target_reference_requirements.required_source_ref_ids`에 해당 ID·원문이 들어갔다. 전체 source_excerpts의 단순 존재에만 기대지 않고 단위별 필수 목록을 보완하는 수정이다.
- 응답 형상: min/max와 enum, 기존 grounding의 중복·전체 ID 검사가 함께 작동한다. 출처 누락·필드 누락뿐 아니라 길이는 그대로인 중복 출처/중복 필드도 거부했다. 완전한 응답은 수락하며 완전한 ID를 썼다는 이유로 uncertain을 pass로 바꾸지 않는다. min/max 자체만으로 유일성이 보장된다는 주장은 하지 않는다.
- 사례 추론: 지문 사실, 적용 기준, 그 둘을 연결한 판단을 구별하는 지시는 타당하다. 구체 회사의 사실 문장까지 기준서에 그대로 있어야 한다는 요구를 피하면서 숨은 사실·추가 규칙이나 성립하지 않는 추론은 fail/uncertain으로 남긴다. 기준서형 일반 규칙의 직접 근거 요구도 유지한다. 실제 모델의 준수 여부는 이 로컬 검토로 검증하지 않았다.
- 오류 기록: `OpenAIRequestError.status/retryable`의 값을 관찰 이벤트에 보존한다. 격리 callback 오류 401은 1회 후 종료하며 401/false, 503은 2회 시도에서 매번 503/true를 기록했다. 기록의 transport는 `injected_response`이므로 실제 HTTP 관측으로 표시하지 않았다. HTTP 상태가 없는 오류에 임의의 상태를 부여하지 않는다. 일반 429 상태만으로 잔액 부족과 속도 제한의 구체 원인을 확정할 수 있다는 뜻도 아니다.
- 과거 응답 schema: 새 chunk 응답의 필수 ID 수 제한은 옛 receipt를 그 응답 schema로 재검사하는 경로가 아니므로, 이번 과거 검증 실패의 직접 원인은 min/max가 아니라 예상 sources 합집합이다.

실행 증거는 `semantic-clarification-independent-evidence.json`, 로컬 검사 코드는 `semantic-clarification-independent.ts`이다. 검사 중 읽은 core·snapshot·원 은행·장부 해시는 모두 그대로였다. 별도 후속 호환 수정은 이 보고서에 포함하지 않고 새로운 증거로 검증한다.
