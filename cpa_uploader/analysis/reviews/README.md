# 검토 데이터와 실행 근거

주제·문제은행 단위의 **기계 판독 검토 장부와 실행 결과**를 검토 작업별 폴더에 보관한다. 설명과 판단 이유는 [`docs/reports`](../../../docs/reports/), 작업 계획은 [`docs/plans`](../../../docs/plans/)에 둔다. 제작 배치에 종속된 초안·계획·출처 패킷·의미검수 receipt는 [`drafts`](../../drafts/)에서 함께 관리한다.

## 정본과 갱신 규칙

- 실행 결과는 해당 시점의 이력이다. 이후의 정답·기대 판정·점수·출처·코드 해시로 덮어쓰지 않는다. 수정 후 검증은 새 실행 파일을 만들고 이전 실행을 연결한다.
- 각 실행은 대상 ID, 실행 시각, 실제 입력 파일과 SHA-256, 적용 판본·가정, 모델/코드 설정, 수동·모의·실제 호출 구분을 기록한다. 최신 내용의 일치 여부는 현재 입력과 다시 대조한다.
- `review_record_complete`, 과거의 pass, mock 결과만으로 현재 문항의 검수나 게시 완료를 표시하지 않는다. 검수·게시 상태의 정본은 문제은행·승급 장부이며, 새 승급은 현재 receipt 계약을 따른다.
- 분석 결과 표·요약은 이력에서 생성하되 원본 장부를 수정하지 않는다. 새 요구사항 대응·현재 공백은 [`coverage`](../coverage/)에서 관리한다.
- 각 실행 폴더 README에 수동 입력, 생성 결과, 검증 명령, 재현할 수 없는 범위를 명시한다. 계정 정보·API 키를 저장하지 않는다.

## 보관 작업

| 작업 | 데이터와 근거 | 사람이 읽는 보고서 |
| --- | --- | --- |
| 사용자 지정 사례형 검토·수정(r01: 55·18·19 병합 v3, r02: 60·21 기타정보 종합, r03: 59·30 급여 서비스조직 병합, r04: 29 초도감사 재구성, r05: 10 감사문서 재구성, r06: 5·25·45 중요성 병합, r07: 46·7·23 외부조회·전문가적 의구심 병합, r08: 52 핵심감사사항·강조사항 대체, r09: 20·61 비교재무제표 병합, r10: 36·67·48 보고서일·후속사건 병합 v3, r11: 35 의견거절 대체). 원 22세트를 퇴역하고 새 11세트를 세 묶음으로 정본·운영 DB에 게시(r01~r04 release `906ca962…`, r05·r06 `31504e78…`, r07~r11 `2ed1a151…`, 364세트) | [case-review-2026-09-15](case-review-2026-09-15/README.md) | [보고서](../../../docs/reports/case-review-2026-09-15.md), [r01 v3 문제지](../../drafts/case-review-2026-09-15/r01-group-audit-merge/v3/questions-and-answers.md), [r02 문제지](../../drafts/case-review-2026-09-15/r02-other-information-merge/questions-and-answers.md), [r03 v2 문제지](../../drafts/case-review-2026-09-15/r03-payroll-service-merge/v2/questions-and-answers.md), [r04 v2 문제지](../../drafts/case-review-2026-09-15/r04-initial-audit/v2/questions-and-answers.md), [r05 문제지](../../drafts/case-review-2026-09-15/r05-audit-documentation/questions-and-answers.md), [r06 문제지](../../drafts/case-review-2026-09-15/r06-materiality-merge/questions-and-answers.md), [r07 문제지](../../drafts/case-review-2026-09-15/r07-confirmation-skepticism-merge/questions-and-answers.md), [r08 문제지](../../drafts/case-review-2026-09-15/r08-kam-emphasis/questions-and-answers.md), [r09 문제지](../../drafts/case-review-2026-09-15/r09-comparative-statements-merge/questions-and-answers.md), [r10 v3 문제지](../../drafts/case-review-2026-09-15/r10-report-date-subsequent-merge/v3/questions-and-answers.md), [r11 문제지](../../drafts/case-review-2026-09-15/r11-scope-limitation-disclaimer/questions-and-answers.md) |
| 기준서형 수정·정답 암시 전수 검토(179세트 v1, 후속 v2 5세트·v3 3세트)와 운영 반영(release `c43c59e4…`) | [standard-spoiler-2026-09-19](standard-spoiler-2026-09-19/README.md) | [검토·반영 결과](../../../docs/reports/standard-spoiler-2026-09-19.md) |
| `pilot-01-005`를 3물음·10점 사례형 종합문제로 대체(세트 ID 유지, 2026-09-18 로컬 정본 설치, 운영에는 release `c43c59e4…`로 함께 반영) | [pilot-01-005-comprehensive-2026-09-18](pilot-01-005-comprehensive-2026-09-18/README.md) | 같은 폴더 README |
| 기출·고급연습 참고 추가 사례3개·9물음 | [case-trio-next-2026-09-14](case-trio-next-2026-09-14/README.md) | [제작·검증 결과](../../../docs/reports/case-trio-next-2026-09-14.md) |
| 사례형 3개·9물음 추가 제작·운영 반영 | [case-trio-2026-09-14](case-trio-2026-09-14/README.md) | [제작·검증 결과](../../../docs/reports/case-trio-2026-09-14.md) |
| 신규 기준서형 53물음(현재 78물음) 전수 검증과 F1–F3·KGA 약칭 21개·경계 사례 B1·B2·관찰 O1–O6 수정·운영 반영 | [standard-new-verification-2026-09-14](standard-new-verification-2026-09-14/README.md) | 같은 폴더 README, [수정 기록](standard-new-verification-2026-09-14/fix-v1/README.md), [v2](standard-new-verification-2026-09-14/fix-v2/README.md), [v3](standard-new-verification-2026-09-14/fix-v3/README.md), [v4](standard-new-verification-2026-09-14/fix-v4/README.md) |
| 심화 사례형 6개·18물음 제작·운영 반영 | [case-deepening-2026-09-14](case-deepening-2026-09-14/README.md) | [제작·검증 결과](../../../docs/reports/case-deepening-2026-09-14.md) |
| 기준서형 분리·통합·부분정답 기준의 정본·운영 반영 | [standard-points-implementation-2026-09-14](standard-points-implementation-2026-09-14/README.md) | [반영·검증 결과](../../../docs/reports/standard-points-implementation-2026-09-14.md) |
| 사례형 적용 확장 6개·18물음 제작·운영 반영 | [case-applied-2026-09-14](case-applied-2026-09-14/README.md) | [제작·검증 결과](../../../docs/reports/case-applied-2026-09-14.md) |
| 기준서형 배점·부분점수 전수 재검토 | [standard-points-2026-09-14](standard-points-2026-09-14/README.md) | [물음별 분리·통합·조정안](../../../docs/reports/standard-points-2026-09-14.md) |
| 후속 사례형 6개·18물음 추가 제작·운영 반영 | [case-followup-2026-09-14](case-followup-2026-09-14/README.md) | [제작·검증 결과](../../../docs/reports/case-followup-2026-09-14.md) |
| 사례형 6개·18물음 추가 제작·운영 반영 | [case-additional-2026-09-14](case-additional-2026-09-14/README.md) | [제작·검증 결과](../../../docs/reports/case-additional-2026-09-14.md) |
| 미게시 기준서형 43물음 정본·운영 반영 | [standard-backlog-publication-2026-09-14](standard-backlog-publication-2026-09-14/README.md) | 같은 폴더 README |
| 기준서형 추가 후보 조사 | [standard-question-gaps-2026-09-14](standard-question-gaps-2026-09-14/README.md) | 같은 폴더 README |
| 사례 분량·물음 수 보강 및 기준서형 분리 | [case-expansion-2026-09-13](case-expansion-2026-09-13/README.md) | [보강·실측·운영 반영 결과](../../../docs/reports/case-expansion-2026-09-13.md) |
| 사례형 사실 활용·요구량 전수 검토 | [case-quality-2026-09-13](case-quality-2026-09-13/README.md) | [검토·수정·게시 결과](../../../docs/reports/case-quality-review-2026-09-13.md) |
| 채점기 ID 제한·검수 변경 후속 검토 | [grader-hardening-2026-09-11](grader-hardening-2026-09-11/README.md) | [발견·수정·실측](../../../docs/reports/채점기-ID-제한-보고서와-관련-변경의-후속-검토-2026-09-11.md) |
| 2027 대비 문항 검토 | [question-review-2027](question-review-2027/README.md) | [전체 결과](../../../docs/archive/과거-검토-증거/reports/question-review-2027/2027-문제-검토-진행-현황.md) |

## 2026-09-14 대용량 사본 정리

2026-09-13~14 작업 폴더의 데이터 사본 318개(약 1.09GB)는 사용자 지시에 따라 저장소 밖 로컬 보관 폴더로 옮겼다. 정본 5종 사본, stage·baseline·backup·db-before 사본, 후보·스냅숏 은행, 초안 원자료 카탈로그 사본, DB payload·SQL이 대상이다. 경로·크기·SHA-256·옮긴 이유는 [copy-archive-2026-09-14.json](copy-archive-2026-09-14.json)에 있다.

- `validate_cpa_v3`가 승급 장부의 검수 기록을 따라 직접 읽는 파일은 모두 남겼다. README·스크립트·로그·검토 장부·완료 기록과 테스트 고정 입력도 남겼다. 현재 정본 검증과 앱에는 영향이 없다.
- 옮긴 파일을 가리키는 게시·DB 반영 기록(`baseline.json`, `stage-completion.json`, `preparation.json` 등)은 보관 폴더 없이는 파일 해시를 다시 확인할 수 없다. 게시된 은행 원문은 운영 DB의 릴리스 이력에 남아 있고, 승급 장부의 과거 상태는 현재 장부의 앞부분이다.

## 2026-09-15 사례형 지정 검토 사본 정리

[case-review-2026-09-15](case-review-2026-09-15/README.md)의 사본 29개(약 90MB)를 같은 기준으로 저장소 밖 보관 폴더로 옮겼다. 대체된 판본 실행(r01 v1~v3, r02 v1, r03 v1, r04 v1)의 후보 은행·분류·카탈로그 사본과 게시 stage·baseline·후보 사본, coverage 반영 전 사본이 대상이며, 목록·SHA-256·이유는 [copy-archive-2026-09-15.json](copy-archive-2026-09-15.json)에 있다. 게시 근거 실행(r01 v4, r02·r03·r04 v2)이 읽는 은행·분류 사본과 DB 준비 보고서는 남겼다. 운영 DB 반영 도구는 옮긴 사본 대신 설치된 정본과 반영 전 커밋의 정본을 해시 대조해 읽었다. 반영이 끝난 뒤 DB 전송 payload·SQL 사본 5개(약 1.3MB)도 [copy-archive-2026-09-15-db.json](copy-archive-2026-09-15-db.json)에 기록하고 옮겼다.

## 2026-09-19 게시 사본 정리

r07~r11 게시 뒤 커밋 전에 사본 33개(약 99.6MB)를 같은 기준으로 저장소 밖 보관 폴더로 옮겼다. 대상은 대체된 r10 v1 실행의 전체 은행·분류·카탈로그 사본, 운영 반영이 끝난 r05·r06 게시의 stage·baseline·후보·정본 카탈로그 사본·coverage 반영 전 사본·DB 전송 payload와 SQL, 운영 반영이 끝난 [pilot-01-005](pilot-01-005-comprehensive-2026-09-18/README.md) 게시의 stage·backup·정본 카탈로그 사본이다. 목록·SHA-256·이유는 [copy-archive-2026-09-19.json](copy-archive-2026-09-19.json)에 있다. 승급 장부의 모든 효율 검수 receipt가 읽는 파일과 현재 자료(coverage·정본·릴리스 기록)가 가리키는 파일은 남겼다. r07~r11 게시의 stage·기준 사본과 운영 전송 SQL은 처음부터 커밋하지 않는 `tmp/`에 두고 기록에는 해시만 남겼다.

기존 자료를 옮길 때에는 이전/현재 경로와 SHA-256을 이전 장부에 남긴다. 문서 링크와 실제 코드의 입력 경로를 갱신하되, 과거 실행 JSON 안에 기록된 당시 경로는 보존한다.

```sh
# 파일을 쓰지 않고 이전 자료의 보존 상태 확인
node cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs --check
# 로컬 전용 출처 파일까지 모두 존재해야 하는 로컬 점검
node cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs --check --require-local
```

위 명령은 파일 이전·보존 검사이며 의미검수나 실제 모델 채점이 아니다. `--apply`는 지정된 과거 폴더만 이전하는 일회성 명령이며, 이전 장부가 있으면 재이전하지 않고 검사한다.
