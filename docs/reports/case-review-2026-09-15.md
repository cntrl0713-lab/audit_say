# 사례형 지정 검토·수정 반영 결과

사용자가 [수정 요청서](../case-question-edit-notes-2026-09-14.md)에서 지정한 사례형 문제 8세트를 새 4세트로 대체해 정본·공개본·암호화본과 운영 DB에 반영했다. 운영 release는 `906ca962-49f3-4155-8c9d-1b3014e6edda`이며 원문 바이트·공개 payload·학습 분류의 DB 왕복 검증과 독립 검증을 통과했다.

| 항목 | 반영 전 | 반영 후 |
| --- | ---: | ---: |
| 세트 | 375 | 371 |
| 전체 물음 | 564 | 551 |
| 전체 총배점 | 1,907 | 1,882 |
| 사례형 부모 | 73 | 69 |
| 사례형 물음·배점 | 192물음·509점 | 179물음·484점 |
| 기준서형 물음·배점 | 372물음·1,398점 | 372물음·1,398점 |
| 학습 단위 | 445 | 441 |

원 8세트의 23물음·58점을 빼고 새 4세트의 10물음·33점을 은행 끝에 붙였다. 나머지 367세트는 내용·판본·분류가 바뀌지 않았다.

## 대체한 문제

| 회차 | 원 문제 | 새 세트 | 구성 |
| --- | --- | --- | --- |
| r01 | 55 `case-14-component-evidence-gap-20260914`, 18 `pilot-14-006`, 19 `pilot-14-007` | [`case-14-group-procedures-20260915`](../../cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v3/questions-and-answers.md) | 그룹감사 절차 2물음·6점 |
| r02 | 60 `case-16-other-information-cause-20260914`, 21 `pilot-16-011` + 기타정보 추가 요소 | [`case-16-other-information-20260915`](../../cpa_uploader/drafts/case-review-2026-09-15/r02-other-information-merge/questions-and-answers.md) | 기타정보 2물음·8점 |
| r03 | 59 `case-13-type2-period-exceptions-20260914`, 30 `pilot-13-011` | [`case-13-payroll-service-20260915`](../../cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge/v2/questions-and-answers.md) | 급여 서비스조직 2물음·7점(사실관계 1,494자 → 1,159자) |
| r04 | 29 `pilot-09-010` + 초도감사 추가 요소 | [`case-09-initial-audit-20260915`](../../cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit/v2/questions-and-answers.md) | 초도감사 4물음·12점 |

모든 새 세트는 옳은 절차·판단과 옳지 않은 절차·판단을 섞어 제시하고 옳지 않은 것을 골라 이유나 보완절차를 간략히 쓰게 한다. 식별에 1점, 옳지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 1점이다. 사실관계·발문·제목에서 정답을 암시하는 표현을 없앴고 연도는 20X1·20X2로 썼다(대상 연도 2027년). r04 물음 2는 사용자 선택에 따라 자료별 경영진주장을 나열하는 열거형이다. 이 기준은 [학습 단위 계약](../물음별-학습-단위와-분류-계약.md#사례형-발문과-절차-선택형)과 제작·검토 스킬에 반영했다.

## 실제 채점

작성 agent가 물음·정답·배점·출처를 원문과 대조한 뒤 Luna로 대표 답안을 채점했다. 게시 근거 실행(r01 v4, r02 v2, r03 v2, r04 v2)의 대표 답안 30개(6·6·6·12)는 모두 기대점수와 정확히 일치했다. 부분정답에는 함정을 옳지 않다고 고른 답과 옳지 않은 항목을 빠뜨린 답을 넣었고, 보조 실측으로 번호만 쓴 답·이유만 쓴 답·보완절차만 쓴 답의 판정도 확인했다. 식별 기준에서 예상 `contradicted`와 실제 `not_met`가 갈린 경우는 모두 0점 상태 사이의 차이이며 원 기대값을 바꾸거나 다시 채점하지 않았다.

r01 v3·r02 v1은 실행 입력으로 고정한 승인 기록의 해시가 이후 결정 추가로 달라져 승급 검증을 통과할 수 없었다. 같은 초안을 현재 입력으로 다시 실측한 r01 v4·r02 v2를 게시 근거로 썼고 이전 실행 증거는 보존했다. 이는 관측된 채점 일관성이며 모든 가능한 답안의 정확도나 통계적 신뢰수준을 뜻하지 않는다.

모든 회차의 실제 호출은 37회이며 비용은 약 $0.108이다(r01 15회 $0.0429, r02 7회 $0.0197, r03 8회 $0.0185, r04 7회 $0.0264. 재실측 판본은 보조 실측을 새로 하지 않고 앞 판본 결과를 인용). 제공자 사용량에 공개 단가를 곱한 추정으로 청구액과 구별한다.

## 운영 전달

- 기존 퇴역 검사 함수는 기준서형 세트만 받았으므로, 모든 물음이 자기 세트의 사례형으로 분류된 세트도 받도록 [20260915090000 마이그레이션](../../supabase/migrations/20260915090000_cpa_reviewed_case_question_retirements.sql)을 두었다. PGlite 회귀로 다른 함수 불변·과거 기록 보존·거절 조건을 확인한 뒤 운영에 적용했고, 적용 전후 비교에서 이 한 함수만 바뀌고 권한은 같았다.
- 퇴역·추가 import는 운영에 저장된 active 원문에서 원 8세트를 빼고 새 4세트를 붙이는 방식이다. 로컬 PGlite로 최종 원문과 전체 payload가 정본과 같음을 먼저 증명했고, 운영 read-only probe에서 같은 payload 해시를 확인한 뒤 한 번 적용했다. 적용 트랜잭션은 함수 정의·기대 release·payload 해시를 확인하고, 남은 세트의 판본·분류와 학습 주제가 바뀌지 않았는지와 원 세트가 비활성인지 검사한다.
- 왕복 검증에서 원문 바이트·공개 payload·분류 551행·학습 단위 441개·주제가 정본과 일치했다. 독립 검증은 read-only 요청 375회, 쓰기 0회로 통과했다. 퇴역 manifest는 과거 판본과 풀이 기록의 보존(`preserve`)을 명시하며, 원 세트의 과거 판본과 풀이 기록은 DB에 남는다.
- 운영 DB 명령은 사용자가 직접 실행했다. 재시도는 없었다.

## 반영·보존 근거

- [검토 장부와 게시 단계](../../cpa_uploader/analysis/reviews/case-review-2026-09-15/README.md#게시와-운영-반영)
- [정본·공개본 설치 검증](../../cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/install-completion.json)
- [운영 DB 독립 검증](../../cpa_uploader/analysis/reviews/case-review-2026-09-15/publication/db-import/publication-v1/verification.json)
- [초안 폴더](../../cpa_uploader/drafts/case-review-2026-09-15/README.md)

퇴역 세트를 가리키던 은행 대상 coverage 관계 3건은 대체 물음으로 다시 연결했고 퇴역 세트의 wiki 생성 페이지 8개는 원 바이트로 보존한 뒤 제거했다. 대체된 판본 실행의 은행 사본과 게시 stage·baseline·DB 전송 사본 34개(약 91MB)는 저장소 밖 보관 폴더로 옮겼으며 목록과 SHA-256은 [copy-archive-2026-09-15.json](../../cpa_uploader/analysis/reviews/copy-archive-2026-09-15.json)·[copy-archive-2026-09-15-db.json](../../cpa_uploader/analysis/reviews/copy-archive-2026-09-15-db.json)에 있다. 정본 반영 커밋에서 타입 검사·전체 테스트 599개·분석 동기화·wiki 검사가 통과했다.
