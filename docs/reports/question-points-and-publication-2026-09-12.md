# 문항 배점 검토와 운영 DB 반영 — 2026-09-12

351물음의 배점 검토와 운영 DB 입력은 완료했다. **사후 검사에서 발견한 채점 보조조건 누락의 복원 SQL은 로컬 검증을 마쳤으나 운영에 적용하지 않았다. 사용자의 요청에 따라 이 상태에서 작업을 중지한다.** [구체적인 재개 지시서](../plans/question-verification-resume-after-pause-2026-09-12.md)에 진행 내역·미완료 항목·명령·합격 조건을 남겼다.

## 배점 검토 결과

| 구분 | 결과 |
| --- | ---: |
| 전체 물음 | 351 |
| 기준서형 / 사례형 | 279 / 72 |
| 총 배점 | 1,298점 |
| 기존 운영 물음 | 212 |
| 기존 배점 유지 / 변경 | 126 / 86 |
| 변경 중 상향 / 요구 분리에 따른 하향 | 84 / 2 |
| 운영에 추가한 물음 키 | 139 |

열거형은 독립 정답 요소, 서술형은 독립적으로 인정할 수 있는 의미 단위에 정수 점수를 부여했다. 판단과 근거의 독립 득점, 부분답, 중복 배점, 발문의 요구량과 서술·추론 부담을 물음별로 확인했다. 글자 수에 비례하여 배점하지 않았다.

이번 대상 281물음은 내용·출처·배점을 다시 검토했고, 나머지 70물음은 기존 검토와 현재 내용의 동일성을 대조했다. 운영에 추가한 139개 키에는 요구사항 분리와 추가가 포함된다. 자세한 전후 점수와 이유는 [351물음 운영 대비 배점표](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/a/operational-point-diff-v1.md), [전체 검토 범위](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/a/bankwide-point-coverage.md), [선택 물음별 상세 검토](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/point-allocation-review.md)에 남겼다.

기존 `pilot-10-002/sub1`의 4→3점, `pilot-18-003/sub2`의 12→11점은 일부 요구를 별도 물음으로 옮긴 결과다. 각각 전체 요구를 3·6·3점과 11·9·8점으로 나눴다. 미게시 초안 `pilot-08-008/sub2`의 17점은 8점과 9점의 독립 기준서형 물음으로 분리했다.

## 주제19

| 물음 | 이전 운영 → 반영 배점 |
| --- | ---: |
| 19-001/sub2 | 2 → 5 |
| 19-002/sub1 | 3 → 6 |
| 19-002/sub2 | 5 → 8 |
| 19-003/sub2 | 2 → 3 |
| 19-004/sub1 | 2 → 3 |

다른 주제와 함께 연결된 물음까지 포함하면 주제19는 12물음·44점이다. [주제19 상세 검토](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/a/topic-19-point-detail.md)에 독립 요구·부분답 예시·출처를 기록했다. 요구가 단일 판단인 `19-005/sub2`는 1점을 유지했다.

## 내용 검토와 채점 일관성

wiki·출처·발문·모범답안·배점·QA 기대값에 95%나 ±1점의 오류 허용률을 적용하지 않았다. 이번 검토에서 발견한 내용·출처·기대값 오류는 수정했고, 원문과 과거 실행 증거는 보존했다. agent의 직접 검토를 사람의 확인이나 별도 유료 API 의미검수로 표시하지 않았다.

고정된 대표 답안 830개를 평가한 결과 821개는 기대점수와 같고 나머지 9개는 ±1점 이내였다. 830/830의 관측 일관성이 사용자 기준을 충족한다. 이는 고정한 답안 집합의 결과이며, 통계적 신뢰수준 95%를 입증하거나 모든 가능한 답안의 정확성을 보장하는 수치는 아니다. [최종 실측 집계](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/sealed-results-v4/summary.json), [증거 수락 결과](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/sealed-results-v4/readiness.json).

이번 비용 통제 배치에서는 Luna로 실제 742회 호출했다. 반환된 2,514,095토큰과 고정 단가로 계산한 비용은 **US$0.84561490, 약 $0.85**다. 교체된 과거 4회 비용을 포함하며 재사용은 중복 계산하지 않았다. 별도 유료 API 의미검수는 0회다. 이 금액은 청구서 금액 또는 다른 과거 배치·agent 대화 비용을 뜻하지 않는다. [사용량·비용 독립 집계](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/b/final-api-accounting-v1.md).

## 적용과 검증 기록

- 최종 검증 버전: `question-verification-2026-09-12-efficient-004`.
- 게시 전 격리 검증 9단계와 정본 설치 후 전체 검사·분류 재현 검사 통과. [정본 설치와 백업](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/canonical-install-v1/install-004/completion.json).
- `analysis:build`, `analysis:check`, `wiki:build`, `wiki:check` 모두 통과. wiki는 154개 저장 묶음·351물음·1,298개 배점 기준을 반영했다. [실행 결과](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/checks/final-build-results.json).
- 변경된 효율 검증·실행·봉인 코드의 관련 테스트 88개, 타입 검사, 대상 lint 통과. 실행 시 원응답과 해시를 재검사했으며 원증거를 새 판정에 맞춰 덮어쓰지 않았다.
- AGENTS와 제작·검토 스킬에 유형 구분, 물음별 배점 타당성, 정수 부분점수, 기반자료 정확성과 채점 편차 허용의 구분을 반영했다. [최종 정책 대조](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/a/policy-final-check-v1.json).
- 운영 DB 적용 시각: **2026-09-12 14:02:25 KST**. 릴리스: `2fe460a1-8107-40cd-8afd-e6eb539ef997`. [원 적용 영수증](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-publication-v4/receipt.json).
- 정본 SHA-256: `4891f97bcfc98cdeda77567b59657577da184317df199fd53c859004728acd80`.
- 독립 DB 사후 대조: 첫 검사에서 비공개 조회 필드 누락으로 실패. 복원 SQL의 운영 적용과 후속 전수 대조는 미실행이며 최종 운영 검증 완료 상태가 아니다.

첫 사후 대조에서 원문 보존·공개본·배점·학습 분류는 일치했으나, 비공개 조회 결과가 출처 위치 메타데이터 319개와 네 문제의 채점 범위 `scope` 13개를 전달하지 않는 것을 발견했다. 실제 채점에 쓰이는 조건이므로 오차 허용으로 처리하지 않았다. 문제 버전과 해시로 결속된 보존 원문에서 해당 두 필드만 복원하는 신규 SQL을 준비했다. 실제 격리 PostgreSQL 검사 40/40과 채점 payload 대조를 추가한 최종 검사 1/1이 통과했다. 현재 154개와 이전 104개 저장 묶음의 private DTO·채점 payload·지시문, 원 테이블·공개 조회 보존을 확인했다. [복원 코드 및 로컬 인계](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c/private-source-metadata-v1/handoff.md).

운영 DB에서는 이 복원을 아직 수행하지 않았다. 현재 활성 릴리스의 네 문제에 해당 보조조건 조회 누락이 남아 있으며, 후속 작업의 첫 해결 대상이다. 운영 DB 추가 변경·원격 조회·유료 API 호출·자동 재개는 중지했다.

학습 표시 기준으로는 기준서형 독립 물음 279개와 사례형 부모 문제 41개, 총 320개 학습 단위다. 사례형 부모에는 72개 사례형 물음이 연결된다. 154개 저장 묶음 수와 학습 물음 수를 구분한다.

과거 잠금·실측·초안·정본 백업을 보존했다. 이번 적용은 문제은행과 학습 분류를 대상으로 했고 학습자의 과거 답안·진도 초기화나 운영 앱 코드 배포는 수행하지 않았다.
