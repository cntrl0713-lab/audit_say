# firm_collector — 회계법인 리서치 데이터 수집기 (M1)

`docs/PLAN_PRD_v2.md` §4 의 수집 설계를 구현한 연 1회 배치다.
적재 대상 스키마는 `docs/firm-platform-schema.md` 를 본다.

---

## ⚠ 첫 실행 전 확인 (읽지 않고 돌리지 말 것)

**이 코드는 실제 OpenDART 호출로 검증된 적이 없다.** API 키가 없는 상태에서 작성했다.
엔드포인트 경로와 응답 필드명은 OpenDART 개발가이드 기준으로 적었지만,
**필드명이 하나라도 다르면 값이 조용히 NULL 로 쌓인다.**

그래서 첫 실행은 반드시 이 순서로 한다.

```bash
# 1. 회사 한 곳만, 결과를 파일로 받아서 눈으로 확인한다
npx tsx --env-file=.env.local scripts/firm_collector/run.ts engagements \
  --year 2024 --corp 00126380 --report /tmp/probe.json

# 2. 적재된 행을 직접 본다 — NULL 이 몰려 있으면 필드명이 어긋난 것이다
#    (Supabase SQL Editor)
#    select * from v_firm_clients where corp_code = '00126380';
```

`adt_opinion` · `revenue` · `audit_fee_total` 이 전부 NULL 이면
`dartClient.ts` 의 엔드포인트나 `collectEngagements.ts` 의 필드 접근을 고쳐야 한다.
고쳐야 할 필드명은 아래 표에 모아 뒀다.

| 쓰는 곳 | 엔드포인트 | 읽는 필드 |
|---|---|---|
| 감사인·의견 | `accnutAdtorNmNdAdtOpinion.json` | `adtor`, `adt_opinion`, `emphs_matter`, `core_adt_matter`, `rcept_no`, `corp_cls`, `corp_name` |
| 감사용역 | `adtServcCnclsSttus.json` | `adt_cntrct_dtls_mtrpz`(보수), `adt_cntrct_dtls_tot_tm`(시간) |
| 비감사용역 | `accnutAdtorNonAdtServcCnclsSttus.json` | `cntrct_cncls_de`, `servc_cn`, `servc_exc_pd`, `servc_mnrt` |
| 재무 3지표 | `fnlttSinglAcnt.json` | `fs_div`, `account_nm`, `thstrm_amount` |
| 직원 현황 | `empSttus.json` | `fo_bbm`, `sm`, `rgllbr_co`, `cnttk_co`, `fyer_salary_totamt` |
| 임원 현황 | `exctvSttus.json` | `rgist_exctv_at` |

응답 **껍데기**(`status` / `message` / `list`)와 상태코드 처리는 픽스처로 검증돼 있다
(`tests/firmCollector.test.ts`). 검증 안 된 것은 위 표의 **개별 필드명**뿐이다.

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
# 감사대상회사 (상장사 전체, 2025 사업연도)
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
| `--report <path>` | 수집 보고서 JSON 저장 |

## 재실행해도 안전하다

모든 쓰기가 자연키 upsert 다 (PRD §11 "동일 사업연도 재수집 시 중복 방지").

| 테이블 | 중복 방지 키 |
|---|---|
| `firm_company` | `corp_code` |
| `firm_engagement` | `(firm_id, corp_code, bsns_year)` |
| `firm_audit_opinion` · `firm_financials` | `engagement_id` |
| `firm_profile_yearly` · `firm_workforce_yearly` | `(firm_id, bsns_year)` |

`firm_service_contract` 만 예외다. 계약 한 건을 특정할 자연키가 없어서
engagement 단위로 지우고 다시 넣는다.

## 수집 보고서

배치가 끝나면 무엇을 못 했는지 JSON 으로 남는다. PRD M1 의 "파싱 정확도 검증 문서" 가
이 파일이다.

| 항목 | 뜻 | 할 일 |
|---|---|---|
| `unmatchedAuditors` | 감사인명이 `firm_registered` 에 없다 | 마스터에 법인을 추가하거나 `alias` 를 보강한다 |
| `unnormalizedOpinions` | 의견 원문을 못 접었다 | `normalizeAuditOpinion` 에 표현을 추가한다 |
| `financialsMissing` | 재무 계정을 못 찾았다 | 금융회사면 정상. 아니면 계정명 alias 를 본다 |
| `corpCodeMissing` | 회계법인의 DART 고유번호를 못 찾았다 | 마스터의 법인명 표기를 DART 표기와 맞춘다 |
| `segmentsUnavailable` | 직원 현황에 사업부문이 안 왔다 | 부문별 인원은 P2 원문 파싱으로 넘긴다 |
| `errors` | 회사별 실패 | 개별 재실행 (`--corp`) |

인증키 오류(010·011·012·901)는 보고서에 담지 않고 즉시 배치를 세운다 —
남은 수천 건에서 똑같이 터질 오류로 API 할당량을 태울 이유가 없다.

## 아직 안 하는 것

PRD §4.3 의 2차 수집 범위다.

- 비상장회사 감사보고서 원문 파싱 (1차는 `stock_code` 가 있는 상장사만)
- 금융회사 재무 3지표 보완 (지금은 `data_status = 'missing'` 으로 남는다)
- KAM 주제 분류·태깅 (지금은 원문 보관 + 번호 세기만)
- **부문별 매출** (`firm_profile_yearly.revenue_*`) — 구조화 API 에 없어 전부 NULL 이다.
  부문별 **인원**은 직원 현황의 `fo_bbm` 으로 나눌 수 있어 1차에서 채운다.
- `firm_company.induty` — 기업개황 API 를 아직 붙이지 않아 NULL 이다.

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

네트워크를 타지 않는 부분(`normalize.ts`·`zip.ts`·`dartClient.ts` 의 응답 처리)은
`tests/firmCollector.test.ts` 가 픽스처로 검증한다. `npm test` 에 포함돼 있다.
