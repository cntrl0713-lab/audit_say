# firm_collector — 회계법인 리서치 데이터 수집기 (M1)

`docs/PLAN_PRD_v2.md` §4 의 수집 설계를 구현한 연 1회 배치다.
적재 대상 스키마는 `docs/firm-platform-schema.md` 를 본다.

실제 적재 테이블은 `cpa_firm_*`다. 연간 RPC와 캐시 payload의 `tables.firm_*` 키는 기존 계약을 유지하고 DB 접근 시 새 이름으로 연결한다. [테이블 이름과 호환 규칙](../../docs/cpa-table-prefix.md)을 참고한다.

---

## 첫 실행 전 확인 — 2026-09-08 실호출 검증 반영

삼성전자(00126380)의 2024·2025 사업연도 API 응답과 적재된 뷰를 대조했다.
두 연도 모두 삼정회계법인·적정의견·KAM 2개와 재무 3지표를 확인했다.
당기·전기·전전기를 함께 보내는 API에서 당기만 고르고, 중복 연결/별도 행을 합친다.
선택 필드(KAM 등)의 부재는 결측으로 보존하며, 같은 감사인의 상충하는 의견은 검토 대상으로 남긴다.

사용자 결정에 따라 **감사대상회사의 감사/비감사 보수와 임직원은 수집하지 않는다.**
감사인·의견·KAM·재무 3지표가 이번 수집 범위다. 기존 용역 테이블·화면은 별도 정리 대상이다.
회계법인 자체 인력·재무 API 조회는 별도이며, 최종 마스터 63개 항목 중 고유번호를 확인한
59개 항목에서 두 연도 모두 빈 응답이었다. 이를 인원/매출 0으로 저장하지 않는다.
빈 응답은 해당 API 데이터 부재이며 공시 원문이 없다는 뜻은 아니다. 원문 파싱은 이번 범위 밖이다.

프로브 명령 (Windows PowerShell):

~~~powershell
$env:DART_CACHE_DIR='.cache/firm_collector/2026-09-08'
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/run.ts engagements --year 2024 --corp 00126380 --report docs/reports/probe-00126380-2024-corrected.json
~~~

적재 확인: v_firm_clients에서 corp_code='00126380'과 사업연도로 조회한다.
adt_opinion·revenue·operating_profit·net_income을 대조한다. 보수는 범위에서 제외했으므로 NULL이 정상이다.

| 쓰는 곳 | 엔드포인트 | 확인한 필드 |
|---|---|---|
| 감사인·의견 | accnutAdtorNmNdAdtOpinion.json | adtor, adt_opinion, bsns_year, emphs_matter(선택), core_adt_matter(선택), rcept_no, corp_cls, corp_name |
| 재무 3지표 | fnlttSinglAcnt.json | fs_div, account_nm, thstrm_amount, currency |
| 회계법인 직원 | empSttus.json | 일반 응답 필드명은 확인했으나 회계법인 실데이터 미확보 |
| 회계법인 임원 | exctvSttus.json | 일반 응답 필드명은 확인했으나 회계법인 실데이터 미확보 |

초기 프로브에서 감사보수 필드가 adt_cntrct_dtls_mendng, 시간은 adt_cntrct_dtls_time,
비감사보수는 servc_mendng임을 확인했다. 금액 단위도 응답에 없다.
이 필드들은 이번 수집에 사용하지 않는다. 보수 API가 원 단위를 보장한다고 가정하면 안 된다.

---

## 준비

`.env.local` 에 세 개가 필요하다.

```
DART_API_KEY=...                  # https://opendart.fss.or.kr 에서 발급 (무료, 일 20,000건)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...     # firm_* 테이블에 쓰기 정책이 없어 service_role 이어야 한다
```

## 실행

```bash
# 감사대상회사 (종목코드 보유 회사 전체, 상장폐지 회사 포함, 2025 사업연도)
npm run firm:collect:engagements -- --year 2025 --report docs/reports/engagements-2025.json

# 회계법인 자체 인력·재무
npm run firm:collect:profiles -- --year 2025 --report docs/reports/profiles-2025.json
```

옵션

| 옵션 | 뜻 |
|---|---|
| `--year <n>` | 사업연도 (필수) |
| `--limit <n>` | 앞에서 n 곳만. 시범 수집용 |
| `--corp <code>` | 특정 회사만. 여러 번 줄 수 있다 |
| `--report <path>` | 회사별 처리 때마다 진행 보고서 JSON 저장 |
| `--resume` | 동일 연도 보고서의 완료 회사를 건너뛰고 중단·실패 회사 재처리 |
| `--retry-from <path>` | 오류·미매칭·외화 보류 회사를 별도 보고서에 재처리 (`--resume`과 함께 사용 불가) |

## 재실행해도 안전하다

모든 쓰기가 자연키 upsert 다 (PRD §11 "동일 사업연도 재수집 시 중복 방지").

| 테이블 | 중복 방지 키 |
|---|---|
| `cpa_firm_company` | `corp_code` |
| `cpa_firm_engagement` | `(firm_id, corp_code, bsns_year)` |
| `cpa_firm_audit_opinion` · `cpa_firm_financials` | `engagement_id` |
| `cpa_firm_profile_yearly` · `cpa_firm_workforce_yearly` | `(firm_id, bsns_year)` |

이번 파이프라인은 `cpa_firm_service_contract`를 조회·변경하지 않는다.

## 수집 보고서

배치가 끝나면 무엇을 못 했는지 JSON 으로 남는다. PRD M1 의 "파싱 정확도 검증 문서" 가
이 파일이다.

| 항목 | 뜻 | 할 일 |
|---|---|---|
| `unmatchedAuditors` | 감사인명이 `cpa_firm_registered` 에 없다 | 마스터에 법인을 추가하거나 `alias` 를 보강한다 |
| `unnormalizedOpinions` | 의견 원문을 못 접었다 | `normalizeAuditOpinion` 에 표현을 추가한다 |
| `financialsMissing` | 재무 계정을 못 찾았다 | 금융회사면 정상. 아니면 계정명 alias 를 본다 |
| `financialsUnsupportedCurrency` | 원화가 아닌 재무금액 | 원화 환산 근거 확보 전 금액 NULL·`parse_failed` 유지 |
| `corpCodeMissing` | 회계법인의 DART 고유번호를 못 찾았다 | 마스터의 법인명 표기를 DART 표기와 맞춘다 |
| `segmentsUnavailable` | 직원 현황에 사업부문이 안 왔다 | 부문별 인원은 P2 원문 파싱으로 넘긴다 |
| `errors` | 회사별 실패 | 개별 재실행 (`--corp`) |

인증키 오류(010·011·012·901)와 재시도 후 요청한도 오류(020)는 보고서를 남기고 배치를 세운다 —
남은 수천 건에서 똑같이 터질 오류로 API 할당량을 태울 이유가 없다.

## 아직 안 하는 것

PRD §4.3 의 2차 수집 범위다.

- 종목코드가 없는 회사의 감사보고서 원문 파싱 (1차는 `stock_code`가 있는 회사)
- 금융회사 재무 3지표 보완 (지금은 `data_status = 'missing'` 으로 남는다)
- KAM 주제 분류·태깅 (지금은 원문 보관 + 번호 세기만)
- **부문별 매출** (`cpa_firm_profile_yearly.revenue_*`) — 구조화 API 에 없어 전부 NULL 이다.
  부문별 **인원** 분류기는 있지만 회계법인 직원 API의 실데이터가 없어 이번에는 채우지 못했다.
- `cpa_firm_company.induty` — 기업개황 API 를 아직 붙이지 않아 NULL 이다.

## 파일

| 파일 | 역할 |
|---|---|
| `normalize.ts` | 순수 함수. 금액·날짜·의견·법인명 정규화, 부문 분류 |
| `zip.ts` | corpCode.zip 을 풀기 위한 최소 ZIP 리더 |
| `dartClient.ts` | HTTP, 상태코드, 재시도, corpCode.xml 파싱 |
| `store.ts` | Supabase service_role 적재 |
| `collectEngagements.ts` | 감사대상회사 파이프라인 |
| `collectFirmProfiles.ts` | 회계법인 인력·재무 파이프라인 |
| `run.ts` | CLI |
| `responseMapping.ts` | 당기 식별·중복 의견 병합·전체 법인명 후보 대조 |
| `reconcileAuditors.ts` | 미매칭 보고서에서 고유번호가 유일한 신규 법인 후보 제시·적용 |

네트워크를 타지 않는 부분(`normalize.ts`·`zip.ts`·`dartClient.ts` 의 응답 처리)은
`tests/firmCollector.test.ts` 가 픽스처로 검증한다. `npm test` 에 포함돼 있다.

## 재개와 캐시

DART_CACHE_DIR를 설정하면 인증키를 제외한 응답과 회사 목록을 로컬에 보존한다.
동일 캐시로 재처리하면 이미 받은 API 응답은 다시 호출하지 않는다.
새 기준일에 공시 정정을 다시 수집하려면 새 날짜의 캐시 폴더를 사용한다.
회사 4곳을 동시에 처리하되, 한 클라이언트의 API 호출 시작 간격은 유지한다.
회사별 upsert는 독립적이며 진행 보고서에는 completedCorps·noAuditor·errors를 기록한다.
완료 목록은 적재 성공만 뜻하지 않는다. 공시 없음·감사인 없음·미매칭으로 검토 완료한 회사도 포함한다.
미매칭을 해결한 회사는 --retry-from 또는 --corp로 별도 보고서에 재처리한다(--resume은 완료 회사 건너뜀).
보고서 저장은 직렬화하고 Windows의 일시적 파일 잠금은 제한 횟수만 재시도한다.

~~~powershell
$env:DART_CACHE_DIR='.cache/firm_collector/2026-09-08'
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/run.ts engagements --year 2024 --resume --report docs/reports/engagements-2024.json
~~~

corpCode.xml에 종목코드가 있어도 현재 공시의 corp_cls가 E이면 비상장으로 표시한다.
회계법인 고유번호는 회계법인이 포함된 전체 법인명으로만 대조한다.
삼일·신한 같은 짧은 alias로 일반 회사 고유번호를 선택하지 않고, 동명 다중 후보는 보류한다.

~~~powershell
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/reconcileAuditors.ts docs/reports/engagements-2025-final.json
# 검토된 고유번호 유일 후보 적용은 같은 명령에 --apply 추가. 등록번호·군은 추정하지 않는다.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/run.ts engagements --year 2025 --retry-from docs/reports/engagements-2025-final.json --report docs/reports/engagements-2025-next-retry.json
~~~

최종 집계는 `docs/reports/collection-summary.json`, 검토 목록은 `collection-review-queue.json`을 본다.
각 연도 `*-final.json`은 본수집 뒤 재처리 회사의 결과를 덮어 반영한 누적 보고서다.
`processed`는 최종 보고서에서 DB의 고유 engagement 수이며, 개별 실행 보고서에서는 upsert 횟수다.


## F004 회계법인 자체 사업보고서

구조화 정기보고서 API와 별개로 `list.json`의 F004 및 `document.xml` 원문 API를 사용한다.
공식 규약: [공시검색](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001), [원문](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019003).
실행별 진행 상태와 보류 사유는 `--report`로 지정한 JSON에 기록한다.

수집 전에 Supabase 인증·회원 스키마를 준비하고 [`supabase/migrations/`](../../supabase/migrations/)의 미적용 SQL을 파일명 순서대로 적용한다. 회계법인 수집·조회 스키마의 순서는 다음과 같다.

1. `20260907000001_firm_platform_schema.sql`
2. `20260907000002_firm_platform_views.sql`
3. `20260907000003_firm_registered_seed.sql`
4. `20260908000001_firm_tier_and_master.sql`
5. `20260908000002_firm_annual_reports.sql`
6. `20260908000003_firm_annual_2026.sql`
7. `20260908000004_firm_annual_start_year.sql`
8. `20260908003002_cpa_table_prefix.sql`
9. `20260908004001_firm_personnel_views.sql`
10. `20260908005001_firm_headcount_and_audit_input_views.sql`

기존 DB는 적용 이력을 확인해 미적용 항목만 반영한다. `cpa_firm_*`로 이름을 바꾼 DB에 과거 `firm_*` 생성·변경 SQL을 다시 실행하지 않는다. 아래 수집 명령은 현재 `cpa_firm_*` 테이블과 `replace_firm_annual_report` RPC가 준비된 상태를 전제로 한다.

```powershell
$env:DART_CACHE_DIR='.cache/firm_collector/annual-2026-09-08'
# 먼저 무쓰기 검증. --corp와 --limit은 원문 파싱 대상을 제한한다.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/run.ts annual-reports --year 2025 --dry-run --report docs/reports/annual/2025-dry-run.json
# 2024·2025·2026을 각각 실행한다. 기본 접수 종료일은 실행 당일(Asia/Seoul)이다.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/run.ts annual-reports --year 2025 --report docs/reports/annual/2025-loaded.json
# 최신 공시·파서·payload hash가 같은 경우에만 DB 쓰기를 건너뛴다.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/run.ts annual-reports --year 2025 --resume --report docs/reports/annual/2025-loaded.json
# 보류/오류만 재시도. 기존 보고서와 다른 경로를 사용한다.
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/run.ts annual-reports --year 2025 --retry-from docs/reports/annual/2025-loaded.json --report docs/reports/annual/2025-retry.json
# 운영 DB와 캐시의 적재 컬럼 전량 대조 (--local-only는 네트워크/DB 없이 파싱 검증).
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/verifyAnnualReports.ts --report docs/reports/annual/db-verification.json
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/firm_collector/compareAnnualClients.ts
```

접수 범위는 기본 2024-01-01~실행 당일(Asia/Seoul)이며 `--end-date YYYYMMDD`로 기준일을 고정할 수 있다.
결산 대상 연도는 사용자 추가 승인에 따라 2024·2025·2026이며, 이후 접수된 해당 결산분의 정정공시도 선정한다.
F004 목록은 같은 캐시를 사용해도 매번 API에서 새로 조회한다. 완료된 목록과 조회 범위는
캐시의 `filings-latest.json`, `filings-latest.meta.json`에 저장한다. 원문 ZIP은 기존 캐시를 재사용한다.
검증·고객사 대조 명령은 기본으로 `filings-latest.json`을 읽는다. 검증 명령의 `--filings 경로`로 과거 목록을 지정할 수 있다.
검증 연도를 제한하려면 `--years 2024,2025`를 지정한다. DB 대조는 적재가 끝난 연도에 실행하며, 연도/테이블별 전체 행을 고유키 순서로 읽어 법인별 원문 파싱 값과 비교한다.
전체 마스터 발견은 목록 전수 기준이며 `--corp`/`--limit` 적용 전이다.
1.8과 6.0 서식을 지원한다. 1.8 최신 후보 231문서에서 수집 대상 필드 키·단위를 대조했고,
원/백만원 단위와 손실 값은 실제 축약 원문 회귀 테스트로 검증한다. 1.4 등 미검증 버전은 보류한다.
같은 법인의 한 결산연도에 여러 결산기가 있으면 전체를 보류한다.
예외: 2026-09-08 사용자 지시에 따라 현대회계법인(00561352) 제20기(2024-04-01~2024-06-30)는 제외한다.
제19기를 2024 결산분으로 선정하고 제21기는 2025 결산분으로 유지한다. 이 제외는 정정 접수에도 적용하며,
다른 법인의 단기 결산분에 일반화하지 않는다. 제외 공시·사유는 보고서에 남기고 원본 캐시는 보존한다.
**실적 기준연도는 보고기간 시작연도(`fy_start_year`)다.** 날짜 원문에서 계산하며 결산말 연도에서 일률적으로 1을 빼지 않는다.
수집 CLI의 `--year`·보고서의 `year`·명세 테이블의 `bsns_year`는 호환성을 위한 결산말 탐색/조인 키다.
분석·비교·공개 화면은 `v_firm_annual_summary.fy_start_year`를 사용한다. 기존 수치를 다른 키로 덮어쓰지 않는다.
같은 시작연도에 두 보고기간이 있는 아크·회계법인윤·회계법인호안·회계법인여일은 각각 보존한다.
자체 정보 화면은 명시적 선택이 없으면 해당 법인의 최신 확보 시작연도를 보여준다.
공개 URL은 `fy_start_year`, 관리자 화면·API는 `fy_start_year`와 `fy_end_date`로 보고기간을 선택한다.
기존 공개 `fy_year`·관리자 `year` 링크는 결산말 연도 키로 해석해 시작연도로 변환한다.
개인 명세 페이지 이동 시 선택한 보고기간을 유지한다. 시작연도는 고객사의 실제 감사대상 연도를 확정하는 값이 아니다.

보고서 상태: `loaded` 운영 적재, `validated` 무쓰기 검증 통과, `not_filed` 해당 조회 범위에 공시 없음,
`held` 서식/정합/식별/복수 결산기 보류, `error` 통신·DB 등 오류.
`warnings`는 표간 불일치·검증 불가·단위 미확인 등이며 값을 임의로 수정하지 않는다.
원문·개인 경력/보수 명세는 비공개로 보관한다. 보고서에는 개인 이름을 출력하지 않는다.
관리자 화면 `/admin/firms/{firm_id}?year=2025`, API `/api/admin/firms/{firm_id}/directors?year=2025`는 실제 관리자 인증이 필요하다.

감사대상회사의 보수·임직원 정보는 이 명령의 대상이 아니다. F004의 연결 감사 회사명은 후보 보고서만 만들고 기존 회사 테이블에 자동 연결하지 않는다.
