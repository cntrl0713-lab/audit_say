# 사례형 지정 검토·수정 초안

사용자가 [수정 요청서](../../../docs/case-question-edit-notes-2026-09-14.md)에서 지정한 사례형 문제만 회차별로 고친다. 공통 기준은 [사례형 발문과 절차 선택형](../../../docs/물음별-학습-단위와-분류-계약.md#사례형-발문과-절차-선택형)이다. 검증 기록은 [analysis/reviews/case-review-2026-09-15](../../analysis/reviews/case-review-2026-09-15/README.md)에 있다.

| 회차 | 폴더 | 원 문제 | 새 세트 | 상태 |
| --- | --- | --- | --- | --- |
| r01 | [r01-group-audit-merge](r01-group-audit-merge/README.md) | 55 `case-14-component-evidence-gap-20260914`, 18 `pilot-14-006`, 19 `pilot-14-007` | `case-14-group-procedures-20260915` v3 (2물음·6점) | v3을 정본·운영 DB에 게시(실측 r01 v4) |
| r02 | [r02-other-information-merge](r02-other-information-merge/README.md) | 60 `case-16-other-information-cause-20260914`, 21 `pilot-16-011` + 기타정보 추가 요소 | `case-16-other-information-20260915` (2물음·8점) | 정본·운영 DB에 게시(실측 r02 v2) |
| r03 | [r03-payroll-service-merge](r03-payroll-service-merge/README.md) | 59 `case-13-type2-period-exceptions-20260914`, 30 `pilot-13-011` | `case-13-payroll-service-20260915` v2 (2물음·7점) | v2를 정본·운영 DB에 게시(실측 r03 v2) |
| r04 | [r04-initial-audit](r04-initial-audit/README.md) | 29 `pilot-09-010` + 초도감사 추가 요소 | `case-09-initial-audit-20260915` v2 (4물음·12점) | v2를 정본·운영 DB에 게시(실측 r04 v2) |
| r05 | [r05-audit-documentation](r05-audit-documentation/README.md) | 10 `pilot-04-006` + 감사문서 추가 요소 | `case-04-audit-documentation-20260917` (2물음·7점) | 정본·운영 DB에 게시(실측 r05 v1, release `31504e78`) |
| r06 | [r06-materiality-merge](r06-materiality-merge/README.md) | 5 `draft-04-320-freq01`, 25 `pilot-04-007`, 45 `case-04-materiality-reset-20260914` + 중요성 추가 요소 | `case-04-materiality-20260917` (2물음·7점) | 정본·운영 DB에 게시(실측 r06 v1, release `31504e78`) |
| r07 | [r07-confirmation-skepticism-merge](r07-confirmation-skepticism-merge/README.md) | 46 `case-09-confirmation-barrier-20260914`, 7 `pilot-02-006`(기준서형 물음 1 포함 퇴역), 23 `pilot-02-007` | `case-09-confirmation-skepticism-20260918` (2물음·8점) | 정본·운영 DB에 게시(실측 r07 v1, release `2ed1a151`) |
| r08 | [r08-kam-emphasis](r08-kam-emphasis/README.md) | 52 `case-16-report-paragraphs-20260914` + 핵심감사사항·강조사항 추가 요소 | `case-16-kam-emphasis-20260919` (3물음·12점) | 정본·운영 DB에 게시(실측 r08 v1, release `2ed1a151`) |
| r09 | [r09-comparative-statements-merge](r09-comparative-statements-merge/README.md) | 20 `pilot-16-010`, 61 `case-16-comparative-opinion-change-20260914` | `case-16-comparative-restatement-20260919` (2물음·7점) | 정본·운영 DB에 게시(실측 r09 v1, 부분 은행, release `2ed1a151`) |
| r10 | [r10-report-date-subsequent-merge](r10-report-date-subsequent-merge/README.md) | 36 `pilot-15-007`, 67 `case-12-restricted-revision-dual-date-20260914`, 48 `case-12-post-report-refusal-20260914` | `case-12-report-date-subsequent-20260919` v3 (3물음·9점) | v3을 정본·운영 DB에 게시(실측 r10 v3, 부분 은행, release `2ed1a151`) |
| r11 | [r11-scope-limitation-disclaimer](r11-scope-limitation-disclaimer/README.md) | 35 `pilot-15-006`(너무 단순해 기출·고급회계감사연습을 참고해 대체) | `case-15-scope-limitation-disclaimer-20260919` (2물음·10점) | 정본·운영 DB에 게시(실측 r11 v1, release `2ed1a151`) |

이 폴더의 `sets.json`은 승급 전 초안이다(`status=needs_review`). 사용자 결정(2026-09-15)에 따라 정본 반영, 원 세트의 활성 릴리스 제외, 운영 DB 등록은 지정 검토를 모아 한 번에 진행했다. r01~r04 네 세트는 검수 승급·게시를 거쳐 정본과 운영 DB(release `906ca962-49f3-4155-8c9d-1b3014e6edda`)에 들어갔고, 원 8세트는 정본과 활성 release에서 빠졌다(과거 판본·풀이 기록은 DB에 보존). r05·r06은 2026-09-18 release `31504e78`, r07~r11은 2026-09-19 release `2ed1a151`로 같은 방식으로 반영했다. 원 세트 14개(r05·r06 4개, r07~r11 10개)는 정본과 활성 release에서 빠졌다. 기록은 [게시와 운영 반영](../../analysis/reviews/case-review-2026-09-15/README.md#게시와-운영-반영)에 있다.
