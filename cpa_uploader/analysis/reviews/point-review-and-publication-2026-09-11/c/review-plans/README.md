# 기존 변경 70세트의 실제 의미검수용 계획

`index.json`의 각 행은 단일 `QuestionAuthoringPlan` 파일과 정확한 `set_id`·파일 SHA-256을 연결한다. 모두 version 1 / `adapt_existing_question`이다. `status=ready`는 적용 범위를 정했다는 뜻이며 모델 의미검수·실제 채점·사람 확인·정본 반영·게시 완료가 아니다. 이 작업에서 API 호출은 0회이다.

## 입력과 범위

- 원본: `../../canonical-before.json`.
- 현재 요구·criterion: `../../prepared-reviewed-v3/candidate-authoring.json`의 변경된 기존 70세트.
- 대상 ID 목록: `../../prepared-reviewed-v1/summary.json`의 `canonical.changed_sets`. v1은 대상 선정 기록이며 v3 검수 결과를 대신하지 않는다.
- 세 담당자의 `../../a/audit.json`, `../../b/audit.json`, `../audit.json`과 `../../root/lineage.json`을 근거로 변경 이유와 분리 계보를 연결했다.
- 원 10-002/sub1, 15-002/sub1, 18-003/sub2의 보완 후 명제를 각각 3·6·3, 7·9·2, 11·9·8점의 독립 물음으로 분리한 현재 후보를 따른다. 분리 전 원 ID의 점수를 그대로 유지했다고 표현하지 않고, 배점 보완 후 분리 단계에서 총점을 보존했음을 구별한다.

70계획은 현재 148물음·593criterion·593점에 대응한다. 각 물음의 실제 발문과 모든 criterion ID·명제·점수를 `scope.required_answers`에 포함했다. 별도 `scope-notes.mjs`는 세트별 주체·시점·조건·예외·제외범위의 수동 작성 입력이다. 원문항·답안·배점은 이 폴더에서 생성하거나 수정하지 않았다.

## 기존 복습과 출처

각 계획은 원 ID의 배점과 부분정답 복원이 목적이며 신규 커버리지라고 주장하지 않는다. 구체 요구가 겹치는 기존 세트와 후속 초안은 실제 ID로 연결했다. 09-003/09-004의 거부 대응, 09-003/09-005의 신뢰성 대응, 14-003/14-005의 연결 과정, 16-002/16-005/16-007의 핵심감사사항, 18-003/18-004의 기준 준수 언급 등이 대표적인 기존 복습이다. 같은 세트 내 같은 요구의 이중 배점을 이 설명으로 허용하지 않는다. 과거부터 모든 중복을 명시했다고 소급하지 않는다.

현재 7,703개 카탈로그에서 202개 source_ref를 216개의 고유 실제 단위로 연결했다. 169개 source_ref에는 공식 전사 단위가 연결되고 33개는 학습자료 단위에만 연결된다. 학습자료를 공식 원문으로 승격하지 않았다. 직접 인용의 근거는 후보의 실제 `source_refs`·`requirements` 및 원문이며, 카탈로그 연결의 실존은 원문 정확성·시행일 확인을 대신하지 않는다.

`source-mapping-evidence.json`은 권위·파일·문단·줄·인용 SHA와 연결 방향을 보존한다. 문단 끝에 다음 절 제목·페이지 표지가 들어간 카탈로그 단위는 전체 인용 문자열과 같다고 주장하지 않고 `same_paragraph_direct_boundary_comparison`으로 구별했다. 14개 경계 대조에서는 원 인용의 마지막 문단 본문이 끝난 뒤 카탈로그에 다음 절 제목만 이어지는 것을 확인했다. 구체 결과는 `paragraph-boundary-evidence.json`에 있다.

새 공식 A 보완 및 710 보론 단위는 `../../a/source-registration-evidence-2026-09-11.json`의 실제 ID를 사용했다. 710 사례의 비상장 가정을 상장으로 바꾼 학습자료는 공식 보론 근거로 사용하지 않았다. 330.8의 실제 PDF 314쪽은 `../../a/source-registration-330-page-followup.json`으로 구별했다. 카탈로그의 없는 page 값을 임의로 채우지 않았다.

승급 장부의 과거 계획 8개 중 이번 변경 대상에 속하는 6개는 실제 `set_id` 일치를 확인하여 계보 참고를 남겼다. 당시 검수나 옛 source ID를 새로운 후보의 검수 완료 근거로 재사용하지 않았다. 다른 64개 계획은 현재 원본·후보·audit으로 구성했다.

## 검사와 인계

`npx tsx .../c/review-plans/validate-plans.ts`는 현재 `validateQuestionAuthoringPlan(plan, true)`와 정확한 세트·주제·발문·criterion·source·해시 연결을 검사한다. 결과는 `static-validation.json`이다. `input-snapshot.json`은 읽은 입력의 당시 해시를 보존하며 내용 승인을 뜻하지 않는다.

모든 계획의 형상 및 명시 ID 연결은 통과했고 미연결 source_ref는 없다. 향후 실행 시 최종 계획 파일·문항·출처·비교은행·공통 코드·모델을 함께 잠근다. 별도 시험 판본의 추가 지정은 현재 조건부 가정의 변경 사유이며, 이 계획이 최종 2027 시험 판본을 무조건 보증하지 않는다. 은행·출처·공통 코드·기존 담당 인계 파일은 변경하지 않았다.
