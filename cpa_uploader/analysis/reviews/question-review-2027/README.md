# 2027 대비 검토의 보존 장부

이 폴더는 2026-09월에 수행한 검토의 당시 입력·판정·실행 근거다. **현재 문제은행 전체의 검수 상태나 2027년 시험 적용 판본을 확정하는 최신 현황표가 아니다.** 현재 요구사항·빈도·포함 범위는 [coverage](../../coverage/)에서, 당시 판단 이유는 [검토 보고서](../../../../docs/archive/과거-검토-증거/reports/question-review-2027/2027-문제-검토-진행-현황.md)에서 확인한다.

| 자료 | 역할 | 수정 방법 |
| --- | --- | --- |
| `01.json`–`19.json` | 주제별 물음·criterion 검토 장부와 당시 스냅샷 | 보존. 후속 검토는 별도 실행으로 기록 |
| [standards-register.json](standards-register.json) | 당시 공식 출처·판본·적용 가정 | 보존. 현행 판본 확인은 새 근거 기록 |
| [plan-manifest.json](plan-manifest.json) | 당시 대상·계획 상태의 기계 판독 목록 | 보존. 사람이 읽는 [계획](../../../../docs/archive/과거-검토-증거/plans/2027-question-review/)은 docs에 유지 |
| `grading-cases/` | 답안·기대 판정·모의/실측·화면·검증 출력 | 원본 실행 단위로 보존. 미측정을 측정 완료로 고치지 않음 |
| `sources/` | 당시 확보한 외부 원자료·이미지 등 참고 | 기존 추적 자료를 유지하고 나머지는 로컬 전용. 없는 파일의 존재·검증을 주장하지 않음 |
| [migration-manifest.json](migration-manifest.json) | 이전/현재 경로·원래 SHA-256·바이트 수·이전 사유 | 이전 이력. 자동 보존 검사 대상으로 사용 |
| [unavailable-artifacts.md](unavailable-artifacts.md) | 보고서가 참조했지만 이전 시 확보되지 않은 과거 근거 경로 | 미보관 상태와 참조 보고서를 명시. 파일·검증 결과를 만들어 채우지 않음 |

`docs/plans/2027-question-review`와 `docs/reports/question-review-2027`의 JSON·`grading-cases`·`sources`를 `cpa_uploader/analysis/reviews/question-review-2027`로 옮겼다. 파일 내용은 바이트 단위로 보존했으며, **JSON·실행 출력에 내장된 과거 경로도 당시 기록 그대로다.** 예전 경로는 이전 장부의 `old_path`를 찾아 `new_path`로 해석한다. 보고서에 남은 실행 명령은 당시 명령일 수 있으며 일회성 스크립트가 현재 존재함을 뜻하지 않는다.

이전 장부의 `originally_tracked`로 기존 Git 추적 여부를 보존한다. 기존부터 추적한 `sources/fsc-2027-scope.pdf`와 `sources/kicpa-list.html`도 새 위치에서 추적한다. 그 외 외부 원자료와 API 원로그의 Git 제외 정책은 유지한다. `local_only: true`인 자료가 새 복제본에 없으면 `unavailableLocal`로 표시하며, 필수 추적 자료의 누락·해시 변경은 오류다. 별도 보관된 원자료가 필요하면 실제 파일과 출처를 확보한 뒤 대조한다.

```sh
node cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs --check
```

이 명령은 이전 장부에 기록된 파일만 읽고 SHA-256·바이트 수·구 경로 중복 여부를 검사한다. 과거 검토를 현재 문항에 적용하려면 현재 문제·출처·계획·채점 코드 해시를 별도로 비교하고 필요한 부분을 다시 검토한다.

보고서의 `파일 미보관` 링크는 [미보관 경로 목록](unavailable-artifacts.md)으로 연결한다. 목록의 원자료·실제 호출 원로그는 이전 전부터 확보되지 않았으며 371개 보존 파일 검사에 포함되지 않는다. 보존 검사가 통과해도 이 미보관 근거를 재확인한 것은 아니다.
