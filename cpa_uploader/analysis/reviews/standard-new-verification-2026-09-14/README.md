# 신규 기준서형 물음 전수 검증 — 2026-09-14

**후속(2026-09-14): F1–F3 수정·재채점·반영 완료.** 10물음의 문구를 고치고 Luna 30건을 새로 채점했다(30건 모두 기대점수와 일치). 정본과 운영 릴리스 `3c521583-7698-4ac7-b247-0d53ae9223ac`에 반영했다. [수정 기록](fix-v1/README.md)을 참조한다. 이어 범위 밖 발문 21개의 KGA 약칭도 고쳐 Luna 63건 재채점(모두 일치) 뒤 운영 릴리스 `80d36a36-cccd-41f4-9cf5-ec5baa73123f`에 반영했다([수정 기록 v2](fix-v2/README.md)). 경계 사례 B1·B2도 채점기준 문구를 고쳐 Luna 21건 재채점(모두 일치) 뒤 운영 릴리스 `3b3a1203-3043-4999-8a47-94f362610946`에 반영했다([수정 기록 v3](fix-v3/README.md)). 관찰 O1–O6도 처리했다. O1 세트 제목 7개, O2 답안 형식 2개, O3 `4906` 병합(4→2점)은 Luna 36건 재채점(모두 일치) 뒤 운영 릴리스 `a80b2a14-7ed3-4642-ba1c-346ac0aa8d6b`에 반영했다. O3 `1cae`는 실측 결과를 보고 분할을 유지했다. O4는 주제01 지침에 판본 감시를 기록했고, O5는 coverage 관계 45건을 추가했다. O6은 변경이 없다([수정 기록 v4](fix-v4/README.md)). 아래 본문은 검증 당시 기록이다.

이 세션이 2026-09-14 정본에 넣은 기준서형 53물음(미게시분 43 + 신규 10)을 현재 정본의 물음으로 추적해 **78물음·315점** 전부를 검증했다. 같은 날 기준서형 배점 재편([standard-points-implementation](../standard-points-implementation-2026-09-14/README.md))으로 30물음이 퇴역하고 55개 새 물음으로 나뉘거나 조정되었기 때문이다. 나머지 23물음은 게시 당시와 바이트가 같다. 다른 세션이 만든 사례형 문제는 범위에 넣지 않았다.

담당 agent의 내용 대조, 기계 검사, 기존 실제 Luna 관측의 결속 확인, 운영 DB·앱 읽기 확인으로 구성했다. **새 모델 호출·정본 수정·운영 쓰기는 없다.** 사람의 직접 검수가 아니다.

## 결과

| 검증 | 결과 |
| --- | --- |
| 내용(발문→요구→모범답안→criterion→원문) | 78물음·315개 criterion 모두 공식 원문과 일치. 정답 오류 0건 |
| 유형·주제·독립 풀이 | 78물음 모두 사실관계 없는 기준서형, 주제 연결과 분류 카탈로그 일치 |
| 배점 | 78물음 모두 유지. 모든 criterion 1점, 같은 의미의 중복 배점 없음 |
| 인용 | 인용 289건(세트 공유 포함) 모두 출처 파일과 공식 전문에 실재, KGA 원행 범위 190건 일치 |
| 중복 | 같은 원문을 쓰는 은행 물음 36쌍을 대조했다. 하위 요구가 다르거나 사례 적용형이어서 중복이 없다 |
| 실제 채점 | 물음마다 모범·부분·오답 3건, 총 234건이 모두 현재 앱 투영과 같은 본문을 채점한 Luna 관측이다. 231건은 점수가 같고 234건 모두 ±1점 이내다 |
| 운영 | 활성 릴리스 `5326b633…` 전체를 독립 검증기로 대조해 통과했다. `/curriculum`·`/quiz`에 78개 학습 ID가 있고, 퇴역한 30개 ID와 정답 필드는 노출되지 않는다 |
| 정본·분석·wiki 검사 | `validate_cpa_v3`(369세트·546물음), `analysis:check`, `wiki:check` 통과. 이후 다른 세션이 raw 수집(`2026-09-14-case-trio`, 16:56)을 추가하면서 wiki 재실행은 `raw/source-manifest.md` drift로 실패한다. 이 폴더의 변경과 무관해 wiki를 재생성하지 않았다 |

## 발견

[content-review.json](content-review.json)의 `findings`에 근거와 수정안을 기록했다. 정답이 틀린 물음은 없다. 모두 채점 허용범위 안이지만 F1–F3은 문구 결함이라 수정 후보다.

- **F1** `std-points-20260914-2089042a4b32/sub3` crit2(외부감사법 제22조제7항): 발문이 묻지 않은 부연 문장이 요건처럼 읽힌다. 그래서 재편 후 저장 모범답안이 4점 중 3점을 받았다.
- **F2** `10e28726886d/sub2` crit1, `97a86c8d6e2f/sub2` crit5·crit8: 기준 명제와 채점 안내가 마침표 없이 이어져 채점 결과 화면에 그대로 보인다. standard-priority 배치 생성기에서 생긴 결함이다.
- **F3** 재편 발문 7개가 `KGA 260` 같은 내부 약칭을 쓴다. 정본 전체로는 28개 발문이며, 그중 21개는 이번 범위 밖이다.
- **B1·B2**: 부분답안이 1점 낮게 채점된 두 경계 사례다. B1(expansion-e01/sub1)은 발문의 전제를 반복하지 않은 답을 감점했다. B2(followup-s03/sub4)는 발문 요구에 비추어 모델의 해석도 가능하다.
- 관찰 O1–O6: 부분 유지 세트의 제목(학습 화면 비노출), 명칭 열거 물음의 `type`, 세분 배점 2건, 윤리기준 판본 감시, coverage 재연결 상태, 인접한 사례형 물음.

수정하려면 발문이나 criterion 문구를 바꾸고 해당 물음의 대표 답안을 다시 채점한 뒤 정본과 운영 DB에 게시해야 한다(F1 1물음, F2 2물음, F3 7물음). 이 폴더는 조사와 수정안까지만 다룬다.

## 파일

- [scope.json](scope.mjs): 53개 원 물음의 현재 물음 추적(유지 23, 재편 55, 퇴역 30)
- [mechanical-checks.json](mechanical-checks.mjs): 형상·배점 계약, 인용 실재·원행, 분류 일치, 관측 결속·점수
- [overlap-candidates.json](overlap-check.mjs): 같은 원문을 쓰는 은행 물음 후보(판정은 content-review.json)
- [content-review.json](build-review.mjs): 물음별 수동 대조 판정, 발견·관찰
- [live-check.json](live-check.mjs), [live-verification.json](live-verification.json), [live-verifier.log](live-verifier.log): 운영 읽기 확인
- validate-cpa-v3.log, analysis-check.log, wiki-check.log: 현재 정본·분석·wiki 검사 출력

## 재현

```sh
node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/scope.mjs
node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/mechanical-checks.mjs
node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/overlap-check.mjs
node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/live-check.mjs
node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/build-review.mjs
```

출력은 모두 새 파일로만 쓰며 기존 파일이 있으면 중단한다. 다시 실행하려면 새 폴더를 만든다. `live-check`는 운영 DB 서비스 키로 읽기만 하고, 운영 앱 HTTP 응답은 실행 시점의 값이다. 브라우저 조작과 사용자 답안 제출은 하지 않았다.
