# wiki 기반·검증 출처 수집 결과

통합학습자료 자체를 기반으로 하고 최초 교재 PDF 8권은 불필요하다는 사용자 확정을 적용했다. [raw 보관소](../../cpa_uploader/raw/README.md)에 기존 자료를 바이트 그대로 복사하고 원래 위치를 유지했다. 과거 원문·문항·검수 receipt의 경로와 해시를 변경하지 않았다.

- 원래 경로 471개 → 고유 보존 파일 458개, 98,780,296바이트. 동일 바이트의 중복 경로 13개는 한 수집 안에서 공유한다.
- 카탈로그 출처 56파일과 실제 wiki가 읽는 자료 입력 146개를 모두 수집했다. 실행 코드·파일 목록용 읽기 5개는 코드 위치·해시로 추적한다. 수동 원발문 목록 5개도 보존했다.
- 통합학습·목차·QA 22개, 기반 참고자료, 공식 원문·전사, 검증용 전문/페이지 추출·이미지, 출처 계보, wiki 입력의 시점 사본을 역할별로 구분했다.
- 과거 미보관 공식 원본 4개를 원 URL에서 다시 확보했고 당시 SHA-256과 모두 일치했다. 옛 경로·상대 경로 34개를 [별도 연결표](../../cpa_uploader/raw/collections/2026-09-11-initial/path-aliases.json)로 해결했다.
- URL만 남은 ISA800 국제기준 PDF는 현재 확보본으로 보존했다. 당시 파일 해시가 없어 과거 바이트 동일성을 주장하지 않으며 국내 적용판본 승인으로 사용하지 않는다.

최초 수집 입력·매니페스트·검사 결과는 [수집 색인](../../cpa_uploader/raw/collections/2026-09-11-initial/index.md)에 있다. 모델 원시 응답·채점 로그·일반 생성 페이지는 원자료와 역할이 다르므로 기존 위치를 유지한다. 사본은 로컬용이며 앱 배포에서 제외했다.

`AGENTS.md`와 제작·검토 스킬에서 raw를 출처 보존의 시작점으로 연결했다. [공통 출처 검증 지침](../../.agents/skills/audit-question-review/references/source-evidence.md)에 원본→추출→전사→인용의 계보, 인용 포함과 문단 완결성의 독립 확인, 각주·제목 귀속, 판본 판단, 입력 한도 진단과 검수 단계 구분을 반영했다. 분류와 배점의 기존 정책은 유지한다.

## 검사

- 원본·사본 471쌍의 바이트·SHA-256 대조: 수집기 및 독립 에이전트 2개 모두 오류 0개. 사람 검수와 구분한다.
- 실제 wiki 입력 누락, 수동 목록, 합성 fixture 제외 검사: 통과. [독립 기록](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/a/raw-crosscheck-v1/collection-independent-validation.json)
- 수집기 경로·변조·중복·덮어쓰기·누락·junction 반례: 수정 후 35/35 통과. [후속 기록](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/b/raw-collector-validation-v1/followup.md)
- wiki 관련 테스트 16/16, 타입 검사, 대상 lint, 두 스킬 형상 검사 통과.
- `analysis:build` → `analysis:check`, `wiki:build` → `wiki:check` 통과. 기존 관계 검토 대기 상태를 수집만으로 승급하지 않았다.

이번 수집·지침 정리의 모델 API 채점은 0회이며 운영 DB·공개 문제은행은 변경하지 않았다. 앞서 승인된 문항 전수 의미검수·실제 채점·DB 반영은 별도 실행 상태로 이어간다.
