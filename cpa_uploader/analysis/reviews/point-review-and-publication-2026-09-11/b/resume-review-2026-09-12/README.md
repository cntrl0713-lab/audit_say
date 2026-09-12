# b 선행 검수와 notes 변경 영향

2026-09-12 재개 승인에 따라 `handoff-001/canary`의 worker b 대상 `pilot-05-003` 의미검수를 실제 실행했다. 현재 입력의 **11단위 전부 pass**, 생성 사례 **45개 전부 의미상 기대 판정 pass**이다. 이는 45개 답안의 실제 학생 채점 결과가 아니다. 모든 단위는 `gpt-5.6-luna`, `transport=model`, attempt 1이며 모델 응답 11건을 보존했다.

- 실행: `execution-resumes/handoff-001/canary/semantic-b/`, worker/CLI 시작 2026-09-11T22:15:42Z, 완료 22:18:12Z, exit 0. 세션 76590 종료.
- receipt: `semantic-b/pilot-05-003/semantic.json`, SHA-256 `f81f4a422d7917bf2aa864f9ab0656ace1037f3266e26fe95f4f74329ccbdacd`.
- 원시 단위: `semantic.json.chunks.jsonl`에 11개 성공 응답, 형상 재시도·실패 행 없음. 실제 입력 288,513자, 고정 은행·코드·출처 guard 유지.
- 정식 생성 사례 채점 `grading.status=not_run`. 총괄의 후속 지시에 따라 grading-b·작성자 QA·smoke를 시작하지 않았다. 현재 활성 API 프로세스는 없다.

## notes-only 민감도 분석

`compare-notes-inputs.mjs`는 실제 함수 `buildGradingPrompt`, `buildGradingResponseSchema`, `selectLearningQuestionSet`, `reviewedContentHash`, `contentHash`를 로컬에서 호출했다. 모델이나 채점 함수를 호출하지 않았고, 후속 은행·분류·QA 파일도 만들지 않았다. 최초 상대 import 경로 오류 1건을 소유 스크립트에서 바로잡은 뒤 전수 대조와 대상 lint가 통과했다.

현재 정본과 `canonical-before.json`의 차이는 83세트의 notes 각 1개뿐이다. 그 정확한 옛 문자열을 v6 후보의 메모리 사본에서 찾아 현재 문자열로 치환했다. 후보 자체의 후속 메모를 유지했고, 대응 실패·notes 외 변경은 없었다. 최종 결과는 `notes-only-input-comparison.json`에 모든 대상과 입력 해시로 보존했다.

| 범위 | 실제 결과 |
| --- | --- |
| 전체 비교 은행 | 153세트 중 notes 83세트 변경 |
| 전수 검증 대상 | 119세트 중 own review hash 변경 56세트; peer bank hash는 119세트 모두 변경 |
| 작성자 QA | 6,029개 원답안의 prompt·schema·모범답안/criterion 기대 계약 변경 0 |
| 학습 단위 | 249개 실제 투영의 prompt·schema·모범답안/criterion 변경 0 |
| 학습 단위의 source/body 해시 | 118개 변경; 문항 내용이 같은지와 저장 파일/판본 결속은 구분 필요 |

`verification.notes`는 `reviewedContentHash`와 source/body 해시에는 포함되지만 학생 채점 prompt/schema에는 포함되지 않는다. 따라서 **메모 경로만 바꾸는 이번 수정은 실제 학생 채점 요청과 기대값을 바꾸지 않는다.** 다만 새 파일 해시를 검사하는 runner, smoke 입력·분류 source hash, 신규 의미검수 receipt의 own/peer bank 결속은 달라진다. 같은 학생 채점 입력이라는 근거만으로 이 잠금들을 덮어쓰거나 새 문항/분류를 자동 수락할 수 없다.

후속 실제 모델 채점 결과를 재사용하려면 해당 답안·기대값·prompt·schema·instructions·모델과 원시 결과의 동일성을 개별 확인하고 새 입력 계보에 연결해야 한다. 특히 미래의 의미검수가 생성할 사례 답안은 달라질 수 있으므로, 다른 생성 답안을 notes-only 동등성으로 재사용해서는 안 된다. 이번 분석에서 옛 분류 rows를 pure projection 함수에 전달한 것은 메모에 대한 영향 검사일 뿐, 달라진 source hash의 분류 판본을 실제로 승인한 것이 아니다.

이번 결과는 사람 확인·승급·게시·DB 완료가 아니다. 원래 semantic receipt·chunks·run·summary와 현재 은행·정본·원자료·공통 코드를 수정하지 않았다.
