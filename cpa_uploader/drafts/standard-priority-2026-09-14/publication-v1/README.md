# 기준서형 우선 추가 10물음 정본·운영 앱 반영 — 2026-09-14

사용자가 승인한 기준서형 **5개 관리 세트·10물음·62점**을 정본과 운영 학습 DB에 게시했다. 정본은 **224세트·474물음·1,752점**이 되었다. 운영 릴리스는 `dadfbfbc…`에서 `a23df670-6096-4b92-b9c0-b04468501e66`으로 바뀌었고, 기존 219세트의 내용과 운영 판본을 보존했다.

- [사용자 승인](authorization.md) · [게시 전 재검토](current-review.json) · [수락 근거](batch.json) · [운영 DB 등록·독립 검증](db-publication-v1/completion.json) · [운영 앱 확인](app-verification.json)

## 게시 전 확인

- 운영 활성 릴리스의 공개 투영이 현재 정본(`7dbf962d…`)과 같음을 읽기 전용으로 확인했다([db-baseline.json](db-baseline.json)).
- 이 배치의 조사·검토 당시 은행이 게시 직전 정본과 같아 중복 대조가 그대로 유효하다. 같은 날 병합된 사례형 6세트 중 `case-09-confirmation-barrier/sub3`은 S01/sub1과 인접할 뿐 중복이 아니다.
- `comparison-inventory.json`의 메모에는 사례형 초안을 넣지 않았다고 적혀 있다. 실제 비교 목록은 병합 후 정본에서 생성되어 그 6세트를 포함한다. 원 파일은 보존하고 [재검토 장부](current-review.json)에 정정을 남겼다.
- 검토 당시 입력(content.mjs·원문 발췌·조사 장부), 실측 receipt의 초안 파일, 채점 runtime이 현재 바이트와 같음을 확인했다.

## 실제 채점 증거

새 모델 호출은 0건이다. 최종 판본의 대표답안 30건에 대응하는 원 Luna 요청·응답(run-v1 24건, run-v2 6건)을 현재 앱 투영·채점 코드로 재처리했다([prepare.mjs](prepare.mjs)). 30건 중 29건은 점수가 같았고 30건 모두 ±1점 이내다. `s01-sub1-partial`의 −1점은 원 배치에서 수락한 판정 편차다. 기준 설명 보완 전 판본의 run-v1 관측 6건은 수락 집합에서 제외했고 원 실행 폴더에 보존한다.

## 게시 단계

| 단계 | 결과 |
| --- | --- |
| 격리 stage ([publish.mjs](publish.mjs) `--stage`) | verified·published 5세트, 승급 장부 +10건, 공개본·암호화본 생성, 전체 검증(224세트·474물음·1,752점), DB 준비 검사 통과 |
| 정본 설치 (`--install`) | 정본 5개 파일 원자적 기록, 분류 카탈로그 `--check`, `validate_cpa_v3` 통과([install-completion.json](install-completion.json)) |
| coverage | 초안 대상 관계 29건을 같은 내용의 정본 대상으로 이관([coverage-promotion.json](coverage-promotion.json)). `analysis:build/check`, `wiki:build/check` 통과. 기존 긴 페이지 경고는 유지 |
| 운영 DB ([deploy.mjs](deploy.mjs)) | 등록 직전 활성 릴리스 재확인 후 `import-question-bank-v3 --apply`. 독립 검증기 `--read-live` 통과: 224세트·474물음(기준서형 354·사례형 120)·학습 단위 403·1,752점 |
| 운영 앱 ([verify-app.mjs](verify-app.mjs)) | `/curriculum`·`/quiz` HTTP 200에서 신규 학습 ID 10개 모두 확인. 한 물음·사례 지문 없음·정답 필드 비노출·합계 62점 |

프런트엔드 재배포는 하지 않았다. 브라우저 조작과 사용자 답안 제출을 통한 추가 채점도 하지 않았다. 코드 변경이 없어 별도 테스트는 실행하지 않았다. 게시 전 배치 README는 [draft-readme.md](draft-readme.md)로 보존했다.
