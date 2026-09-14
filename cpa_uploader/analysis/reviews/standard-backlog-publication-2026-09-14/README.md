# 미게시 기준서형 43물음 정본·운영 앱 반영 — 2026-09-14

2026-09-13에 만든 세 초안 배치의 **27세트·43물음·206점**을 정본과 운영 학습 DB에 게시했다. 정본은 **213세트·446물음·1,635점**이며, 운영 릴리스는 `03697916…`에서 `4f8140ba-d489-4f15-a596-ccc629afb02f`로 바뀌었다. 기존 186세트의 내용·운영 판본은 그대로 보존했다.

- 대상: [standard-gap](../../../drafts/standard-gap-2026-09-13/README.md) 14물음·79점, [standard-expansion](../../../drafts/standard-expansion-2026-09-13/README.md) 15물음·65점, [standard-followup](../../../drafts/standard-followup-2026-09-13/README.md) 14물음·62점
- [사용자 승인](authorization.md) · [게시 전 재검토](current-review.json) · [수락 근거](batch.json) · [운영 DB 등록·독립 검증](db-publication-v1/completion.json) · [운영 앱 확인](app-verification.json)

## 게시 전 확인

- **운영 대조**: 게시 전에 운영 활성 릴리스의 공개 투영이 현재 정본과 같음을 읽기 전용으로 확인했다([db-baseline.json](db-baseline.json)). 이 기록의 `questions` 값은 원시 행 수를 잘못 센 것이다. 원 기록은 보존하고 [정정](db-baseline-count-correction.json)을 따로 남겼다. 공개 투영 일치 판정에는 영향이 없다.
- **내용 재검토**: 담당 agent가 43물음의 발문·모범답안·배점 이유를 읽고 원 검토의 criterion별 근거와 보존 원문을 대조했다. 원문은 KGA 2026년 7월 전문, 윤리기준 2024-12-19 전문, 외부감사법 제9조·제22조다. 결함은 찾지 못했다. 사람의 직접 검수는 아니다.
- **중복 재대조**: 초안 조사 이후 정본에 추가·변경된 54세트 중 같은 기준을 다루는 이웃 64건에 각각 차이 판정을 기록했다([current-review.json](current-review.json), [생성기](current-review.mjs)). G03과 사례형 `pilot-12-001/exp1`은 570.16(b)를 공유한다. 한쪽은 일반 요구, 다른 쪽은 사례 적용이므로 의도된 복습으로 유지했다.
- **입력 불변**: 각 배치 agent 검토 당시의 content.mjs·원문 발췌·조사 장부, 실측 receipt의 초안 파일, 채점 runtime이 현재 바이트와 같음을 확인했다.

## 실제 채점 증거

새 모델 호출은 0건이다. 세 배치의 원 Luna 요청·응답 129건을 현재 앱 투영·채점 코드로 재처리했다([prepare.mjs](prepare.mjs)). 요청 본문·스키마·판정·점수가 원 실행과 모두 같았다.

- 점수 일치 125건, −1점 4건. 129건 모두 ±1점 이내이며 허용 범위 밖 결과는 없다.
- −1점 4건은 모두 부분정답이다. 원 배치의 편차 분석을 보존했으며 기대값은 바꾸지 않았다.
- 기준별 판정까지 같은 엄격 일치는 117건이다. 차이 8건은 0점 오답에서 `not_met`과 `contradicted` 표기만 다른 경우다.
- 사례 ID가 겹치지 않도록 `gap-`·`exp-`·`fol-` 접두어를 붙였다. 원 사례 ID는 `normalization.original_case_id`에 남겼다.

## 게시 단계

| 단계 | 결과 |
| --- | --- |
| 격리 stage 승급·생성·검증 ([publish.mjs](publish.mjs) `--stage`) | verified·published 27세트, 승급 장부 +54건, 공개본·암호화본 생성, 전체 검증, DB 준비 검사 통과 |
| 정본 설치 (`--install`) | 정본 5개 파일 원자적 기록, 분류 카탈로그 `--check`, `validate_cpa_v3` 통과 ([install-completion.json](install-completion.json)) |
| coverage | 초안 대상 관계 16건을 같은 내용의 정본 대상으로 이관([coverage-promotion.json](coverage-promotion.json)). `analysis:build/check`, `wiki:build/check` 통과. 기존 긴 페이지 경고는 유지 |
| 운영 DB ([deploy.mjs](deploy.mjs)) | 등록 직전 활성 릴리스 재확인 후 `import-question-bank-v3 --apply`, 독립 검증기 `--read-live` 통과: 213세트·446물음(기준서형 344·사례형 102)·학습 단위 387·1,635점 |
| 운영 앱 ([verify-app.mjs](verify-app.mjs)) | `/curriculum`·`/quiz` HTTP 200에서 신규 학습 ID 43개 모두 확인. 한 물음·사례 지문 없음·정답 필드 비노출·합계 206점 |

프런트엔드 재배포는 하지 않았다. 브라우저 조작과 사용자 답안 제출을 통한 추가 채점도 하지 않았다. 코드 변경이 없어 별도 테스트는 실행하지 않았다.

## 후속 확인

게시 후 병행 작업 [case-additional-2026-09-14](../case-additional-2026-09-14/README.md)가 이 정본 위에 사례형 6세트를 병합해 운영 릴리스 `dadfbfbc-5433-4b51-9991-59b6289f08e8`로 다시 게시했다. 2026-09-14 읽기 전용 조회에서 그 릴리스는 219세트·464물음이며 이 게시의 27세트·43물음을 모두 포함했다.

## 남은 주의사항

- 윤리 7물음(expansion e01 4물음, followup e01 2물음·e02 1물음)은 현행 2024-12-19 윤리기준을 따른다. 2026-09-02 공개초안이 확정되면(2027-01-01 시행 제안) 문단 번호와 용어를 다시 검토해야 한다.
- 법규 5물음(외부감사법 제9조·제22조)은 2025-04-01 개정 반영본을 따른다.
- 세 배치 README의 본문은 초안 당시 기록이다. 게시 전 사본을 [draft-readme-gap.md](draft-readme-gap.md), [draft-readme-expansion.md](draft-readme-expansion.md), [draft-readme-followup.md](draft-readme-followup.md)로 보존했다.
