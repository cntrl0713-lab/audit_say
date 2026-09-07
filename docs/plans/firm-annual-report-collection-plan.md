# 회계법인 사업보고서(DART F004) 수집 계획서

> 작성일 2026-09-08 · 근거는 전부 당일 실호출·실측이다
> 선행 문서 `docs/PLAN_PRD_v2.md` §4.2-B·§4.3 · `docs/firm-platform-schema.md` · `docs/reports/P0_API_COLLECTION_RESULT.md`
> 구현 대상 `scripts/firm_collector/` · `supabase/migrations/` · `lib/firm/`
> 상태 **승인됨(2026-09-08)** — 이 문서가 정본이다. 같은 이름의 이전 초안을 대체했다

> **구현 중 실측 정정(2026-09-08)**: 아래 최초 조사 내용 중 “2024·2025 모두 서식 6.0”은 틀렸다.
> 2025년 말까지 접수한 최신 후보 원문은 2024 결산분 1.8 232건·6.0 1건, 2025 결산분 6.0 254건이었다.
> **사용자 추가 지시 반영**: 조회 종료일을 실행 당일(한국 시간)로 확대했다. 2026-09-08 기준
> 828공시·266법인이며 추가 253건 원문을 확인했다. 2024·2025 결산분 최신 공시 4건이 변경됐다.
> 현재 2024 최신 후보는 1.8 231건·6.0 2건이다. 아래 초기 모집단 256곳 등은 확대 전 실측이다.
> **후속 승인 반영**: 사용자 “1.8지원하는 형태로 진행”에 따라 1.8·6.0을 지원하고
> 2026 결산분까지 범위를 확대했다. 1.8의 수집 대상 필드·단위와 대표 원문 회귀 테스트를 검증했다.
> 사용자 추가 지시 **“일단 실명 있으면 실명으로 기록해둬”**에 따라 개인 보수도 관리자 전용
> `firm_director_pay`에 저장하도록 변경했다. 원본 ZIP은 비공개 로컬 캐시에 보관한다.
> Supabase MCP로 운영 마이그레이션 두 건을 적용했다. `DATABASE_URL` 설정 대기는 해소됐다. 진행 결과는
> [구현·검증 보고서](../reports/annual/IMPLEMENTATION_RESULT.md)를 참조한다.

---

## 1. 배경과 목표

P0 수집에서 회계법인 **자체** 정보는 한 건도 채우지 못했다. 마스터 63곳 중 고유번호를 확인한
59곳 전부가 `fnlttSinglAcnt`·`empSttus`·`exctvSttus` 에서 빈 응답이었다. 그 결과
`firm_profile_yearly`·`firm_workforce_yearly` 는 전 행 NULL 이고, PRD §4.2-C 의 파생 지표
(1인당 매출·1인당 급여·이사 대비 직원·감사부문 비중)가 분자·분모 없이 계산되지 않는다.

원인을 실호출로 확정했다. **원문이 없어서가 아니라 OpenDART 가 이 서식에 구조화 API를
제공하지 않기 때문**이다. 공시 원문은 정상적으로 존재하고, 오히려 기계 파싱에 유리한 형태다.

이 계획은 그 빈칸을 원문에서 채우고, 사용자 요청에 따라 **인력 전항목 · 임직원 비용 ·
품질관리 · 감리결과**까지 넓힌다.

---

## 2. 실호출로 확인한 사실

### 2.1 회계법인에는 정기보고서 API가 통하지 않는다

삼성전자(00126380, 2024 사업보고서)와 삼일회계법인(00260295)에 정기보고서 계열 엔드포인트
32개를 모두 호출해 대조했다.

| 대상 | 정상 응답 | 데이터 없음(013) |
|---|---:|---:|
| 삼성전자 | **32 / 32** | 0 |
| 삼일회계법인 | **1 / 32** (`company.json` 만) | 31 |

즉 재무·직원·임원·보수·최대주주·배당 등 **어느 것도 API로 얻을 수 없다.** 엔드포인트 이름이
틀린 것이 아니라(삼성전자에서 전부 정상) 회계법인에 해당 데이터가 제공되지 않는 것이다.

**유일하게 통하는 `company.json` 이 주는 것** (삼일 실측):

```
ceo_nm 윤훈수 · jurir_no 1142340004042 · bizr_no 1068119621
adres 서울특별시 용산구 한강대로 100 · hm_url www.samil.com
phn_no 02-3781-3131 · est_dt 19710401 · acc_mt 06 · induty_code 71201 · corp_cls E
```

`acc_mt`(결산월)는 §5.3 의 결산기준일 판정에 쓰고, `induty_code` 는 수집기 README 가
"기업개황 API를 아직 안 붙여 NULL"이라 적어 둔 `firm_company.induty` 를 바로 채운다.

### 2.2 공시는 `pblntf_detail_ty=F004` 로 존재한다

| 확인 항목 | 결과 |
|---|---|
| 공시 유형 | `list.json` 의 `pblntf_detail_ty=F004` = **회계법인사업보고서** |
| 원문 취득 | `document.xml?rcept_no=…` → ZIP 1개 안에 XML 1개 (삼일 2025: 98KB → 1.03MB) |
| 목록 조회 제약 | `corp_code` 없이 부르면 **검색기간 3개월 제한**(status 100). 분기 창으로 나눠 돈다 |
| 서식 버전 | 2024·2025 접수분 전부 `6.0` (ADATE 20230621) |

### 2.3 모집단 실측 — 2024·2025 접수분 전수

`list.json` 을 8개 분기 창으로 완주해 세었다.

| 항목 | 값 |
|---|---|
| 총 공시 건수 | 575 |
| 서로 다른 회계법인(`corp_code`) | **256** |
| 기재정정 | 87 (15%) |
| 결산기준일 월 | 3월 513 · 6월 54 · 12월 2 · 5월 2 · 9월 2 · 8월 2 |
| 보고서 기준연도 | 2025년 268 · 2024년 265 · 2023년 35 · 그 이전 7 |

현재 `firm_registered` 마스터는 63곳이다. **F004 공시가 마스터보다 넓고 정확한 모집단**이며,
P0 에서 고유번호를 보류한 4곳(대성삼경·성도이현·다산·동아송강)도 여기서 확정된다.

### 2.4 원문은 기계키가 붙은 DART 서식 XML이다

표마다 `TABLE-GROUP ACLASS`, 칸마다 `ACODE` 가 붙어 라벨 문자열 매칭이 필요 없다.

```
<TABLE-GROUP ACLASS="TG_RVN_DTL">
  회계감사 | 법정감사(외감법) | [RVN_FY1]299,112,155,738 | [RVN_RT_FY1]26.96 | …
```

2025년 접수 6건(삼일·삼정 등 대형 2 + 예인·성운·선민·권 등 소형 4)에서 **표 그룹 41개 집합이
완전히 동일**했다. 제1기 소형 법인(선민)도 부문별 매출 10행·소계 4행이 대형과 같은 `ACODE` 로
채워져 있었고, 값이 없는 칸은 `0` 이 아니라 `-` 였다. 2020년 접수 1건은 서식 `1.4`·표 그룹 40개
(`NTG_SAL` 없음)로 대상 연도 밖이며 §6.1 인코딩 안전망 검증에만 쓴다.

### 2.5 표 그룹 41개 ↔ 원문 목차 전체 대응

문서 순서로 훑어 전부 대응시켰다. **굵은 것이 이번 범위**다.

| ACLASS | 원문 위치 |
|---|---|
| COVER | 표지 |
| KCBS:K / **KCIS:K** / KCCF:K / KCEF / KCRE:K | I-1 재무상태표 / **손익계산서** / 현금흐름표 / 자본변동표 / 주석 |
| TG_DEBT_DTL / TG_OCP_IVST / TG_DEBT_GRT | I-2 차입금 명세 / 타법인 출자 / 채무보증 |
| **TG_RVN_DTL** | **I-3 사업부문별 매출액** |
| TG_CPT_CHG / TG_ALC_FCP / TG_OFC_DTL | I-6 자본금 변동 / I-7 외국 회계법인 제휴 / I-8 주·분사무소 |
| TG_FACR / TG_FMLC | I-9 외국 감독기구 등록 / 외국증권시장 상장기업 감사 |
| **TG_ARCD_TOT** | **Ⅱ-2-가 감사실적 총괄표** |
| **TG_ARCD_SA / TG_ARCD_SRA / TG_ARCD_SADO** | **Ⅱ-2-나 개별(별도) 감사실적** — 자산규모별 / 연차별 / 의견별 |
| **TG_ARCD_C** | **Ⅱ-2-다 연결재무제표 감사실적** (회사명 명세) |
| TG_DMLC | Ⅱ-3 국내 상장 외국법인 감사현황 |
| TG_ITN_CMT / TG_AFT_CPN | Ⅲ-1-나 지배구조 및 계열회사 |
| **TG_QLT** | **Ⅲ-1-다 품질관리조직·인력** |
| **TG_COST** | **Ⅲ-1-라 품질관리 예산(인건비) 비중** |
| EDU_TRAN | Ⅲ-4-가 품질관리기준 운영 |
| **TG_PUT** | **Ⅲ-5-나 감사투입 인력 및 시간** |
| **TG_HR_TOT** | **Ⅳ-1 인력 총괄표** |
| **TG_HR_ED** | **Ⅳ-2-가 이사의 경력 현황** |
| **TG_SAL / NTG_SAL** | **Ⅳ-2-나 이사의 보수 현황** (실명 / 마스킹) |
| **TG_DCP** | **Ⅳ-2-다 이사의 징계내역** |
| **TG_HR_CHG** | **Ⅳ-3 공인회계사 변동 현황** |
| **TG_HR_CR** | **Ⅳ-4 소속공인회계사의 경력 현황** |
| **TG_BSAL** | **Ⅳ-5 사업부문별 인원 및 보수** |
| **TG_HR_CTF** | **Ⅳ-6 전문자격증 소지 현황** |
| TG_CPST_SV / TG_CPST_ISRC | Ⅴ 손해배상준비금·공동기금 / 책임보험 |
| **TG_ADRV** | **Ⅵ-1 감사보고서 감리결과** |
| **TG_ADQLT** | **Ⅵ-2 감사인 감리결과** |
| TG_SVIT | Ⅶ 최근 3개 사업연도 소송 현황 |

### 2.6 이 계획이 못 하는 것 — 개별(별도) 감사대상 회사명

"나. 개별(별도)재무제표 감사실적"에는 **회사명 명세가 없다.** 자산규모별·연차별·의견별
집계표뿐이다. 회사명이 나오는 표는 "다. 연결재무제표 감사실적"의 `TG_ARCD_C` 하나이고
삼일 기준 629행(= `ARCD_C_FY_SUM`)이다. 같은 보고서의 개별 감사 합계는 1,818사인데
그 명단은 이 공시에 없다.

따라서 "감사실적 개별 명세"의 산출물은 **연결 감사 지배회사 명단 + 종속회사 수 + 감사의견**
이며, 비상장 감사대상 전수 명단 확보를 뜻하지 않는다.

---

## 3. 이 계획의 중심 판단 — 비교되는 값과 안 되는 값

원문의 값은 성격이 둘로 갈리고 **다루는 방법이 정반대**다.

| | A. 서식이 칸을 정한 표 (`TG_*`) | B. 법인이 계정을 정하는 재무제표 (`KCIS:K`) |
|---|---|---|
| 칸의 주인 | DART 서식 — 전 법인 동일 정의 | 법인 각자 |
| 법인 간 비교 | **가능** | **원칙적으로 불가능** |
| 적재 | 정규화 컬럼 | 원문 행 보존 + 표준코드 확인된 계정만 선별 정규화 |
| 쓰는 곳 | 순위·평균·비중 등 교차 분석 | 한 법인의 시계열, 원문 재현 |

### 3.1 임직원 비용 실측 — 2025 결산분 30곳

F004 목록에서 규모가 고르게 섞이도록 일정 간격으로 30곳을 뽑았다(대형부터 제1기 소형까지).

| 개념 | 계정명으로 | 표준코드로 | 판정 |
|---|---:|---:|---|
| **인건비 총액** (`TG_BSAL`·`TG_COST`) | — | **30 / 30** | **A 경로로 확보** |
| 복리후생비 `12417000010000` | 30/30 | **30 / 30** | 정규화 |
| 여비교통비 `12421100010000` | 30/30 | **30 / 30** | 정규화 |
| 교육훈련비 `12422300010000` | 27/30 | **27 / 30** | 정규화 (없으면 NULL) |
| 업무추진비 `12431100060000` | 29/30 | 23 / 30 | 정규화 + **매칭방법 기록** |
| 일반관리비 | 2/30 | 0 / 30 | **비교 불가 — 정규화 안 함** |
| 인건비 *계정* | 30/30 | 28/30 (계정행 77개) | **쓰지 않음** |

**인건비는 계정으로 접근하면 안 된다.** 30곳에서 계정행이 77개로 법인마다 구성이 다르다.

| 법인 | 인건비를 어떻게 적었나 |
|---|---|
| 삼일 | `99999999999999` "인건비(주석10과 14)" 한 줄 |
| 선민 | `99999999999999` "직원급여" + `12414000010000` "상여금" + `99999999999999` "잡급" |
| 성운 | `12412000170000` "급여" + `12415000120000` "퇴직급여" |

비표준 비중도 제각각이다 — 선민은 43행 중 17행, 성운은 43행 중 4행.

**그러나 총액은 서식 표에 있고 손익계산서와 일치한다.** 삼일 2025:

```
TG_COST.COST_ALL           795,751 (백만원)
TG_BSAL.BSAL_CFY_S_SUM     795,751,178,314
KCIS:K "인건비(주석10과 14)"  795,751,178,314    ← 세 값이 같다
```

따라서 **인건비는 계정이 아니라 `TG_COST`·`TG_BSAL` 에서 얻는다.** `TG_BSAL` 은 부문별
(회계감사/세무자문/경영자문/기타) 인원과 보수를 당기·전기·전전기로 함께 준다.

감가상각비·대손상각비 등 임직원과 무관한 계정은 지표로 쓰지 않는다(사용자 확인).
다만 손익 표를 이미 파싱하므로 원문 행은 통째로 보존한다(§5.2 근거).

### 3.2 인력에 관한 사항 실측 — 같은 30곳

**전 법인 확보 (30/30)** — 집계표라 법인 간 비교가 성립한다.

| 항목 | 표 | 담긴 값 |
|---|---|---|
| Ⅳ-1 인력 총괄표 | `TG_HR_TOT` | 사원 / 그중 이사 / 등록회계사 / 수습 / 공인회계사 소계 / 기타직원 / 합계 — 주사무소·분사무소 × 상시·비상시 |
| Ⅳ-3 공인회계사 변동 | `TG_HR_CHG` | 사무소별 기초·증가·감소·기말 |
| Ⅳ-4 소속회계사 경력 | `TG_HR_CR` | 부문 4 × 경력 6구간(1년미만~15년이상) |
| Ⅳ-5 부문별 인원·보수 | `TG_BSAL` | 부문 4 × 당기·전기·전전기 × 인원·보수 |

삼일 2025: 사원 301(그중 이사 173) · 등록회계사 2,512 · 수습 260 · 기타직원 1,190 · 합계 4,263.
입사 308 / 퇴사 237 / 기말 2,813.

**법인마다 유무가 갈리는 명세표**

| 항목 | 표 | 데이터 있는 법인 | 행수(중앙/최대) |
|---|---|---:|---|
| Ⅳ-2-가 이사 경력 | `TG_HR_ED` | **30 / 30** | 9 / 301 |
| Ⅳ-2-나 이사 보수(실명) | `TG_SAL` | **8 / 30** | 0 / 12 |
| Ⅳ-2-나 이사 보수(마스킹) | `NTG_SAL` | **4 / 30** | 0 / 70 |
| Ⅳ-2-다 이사 징계 | `TG_DCP` | **5 / 30** | 0 / 4 |
| Ⅳ-6 전문자격증 | `TG_HR_CTF` | 26 / 30 | 1 / 9 |

`TG_HR_ED` 는 성명·직위·담당업무·근무기간·개업경력·**출자비율**을 담는다.
`TG_DCP` 는 성명이 원문에서 이미 `○○○` 로 마스킹돼 있고 징계내역·일자는 공개다.
`TG_HR_CTF` 는 삼일 기준 세무사 2,849 · 한국변호사 26 · 관세사 2 등.

**`director_pay_total` 은 대부분 NULL 이 된다.** 이사 보수표는 30곳 중 8곳에만 값이 있고,
삼일조차 실명 9 + 마스킹 70 = 79명으로 이사 총원 173명에 못 미친다. 순위·평균 지표로 쓰지 않는다.
반면 `salary_total`(전 임직원 인건비)은 `TG_BSAL` 에서 30/30 이라 영향이 없다.

### 3.3 앞선 배경 문서에서 정정할 2건

`TG_BSAL`("Ⅳ-5 사업부문별 인원 및 보수")을 열어보지 않아 배경 문서가 두 곳에서 틀렸다.

| | 배경 문서(틀림) | 정정 |
|---|---|---|
| `employee_audit/_tax/_advisory` | `CR_TOT_A/T/B` (등록회계사 2,813 기준) | **`BSAL_CFY_P_A/T/B`** (전 임직원 4,263 기준) |
| `salary_total` | "채울 수 없음 — NULL 유지" | **`BSAL_CFY_S_SUM`** (전 임직원 인건비) |

이유는 모집단이다. 삼일 2025 실측:

| 값 | 수 | 무엇을 세는가 | 쓰는 곳 |
|---|---:|---|---|
| `HR_TOT_ALL` = `BSAL_CFY_P_SUM` | 4,263 | 사원+소속회계사+수습+기타직원 **전원** | `employee_total` |
| `BSAL_CFY_P_A/T/B/E` | 2,454 / 813 / 829 / 167 | 같은 4,263 을 **부문별로 나눈 것** | `employee_audit` 등 |
| `HR_CPA_ALL` | 3,073 | 공인회계사만 (수습 260 포함) | 참고 |
| `CR_TOT_SUM` = `HR_END_SUM` | 2,813 | **등록** 공인회계사 (사원 301 + 소속등록 2,512) | `firm_cpa_tenure_yearly` |
| `HR_E_ALL` / `HR_D_ALL` | 301 / 173 | 사원(출자자) / **그중** 이사 — 헤더가 `사원 \| (이사)` | `director_count` |

`BSAL_CFY_P_*` 를 쓰면 부문 합 == 총원이라 "감사부문 인원 비중"이 성립한다. `CR_TOT_*` 를 같은
칸에 넣으면 분모와 어긋나 틀린 비중이 나온다.

`salary_total` 에 전 임직원 인건비가 들어가면 기존 뷰
(`supabase/migrations/20260907000002_firm_platform_views.sql:73`)의
`salary_per_employee = salary_total / employee_total` 이 분자·분모 모두 전 임직원 기준이 되어
비로소 뜻이 맞는다. 이사 보수는 `director_pay_total` 로 분리한다.

---

## 4. 확정된 결정

| 항목 | 결정 |
|---|---|
| 모집단 | F004 공시 전수 **256곳** (마스터 63곳이 아니라 공시 목록에서 역으로 발견) |
| 대상 연도 | **2024·2025 결산분** |
| 범위 | 부문별 매출 · **인력 전항목** · **임직원 비용** · 감사실적(총괄+연결 개별명세) · 품질관리 · 감리결과 |
| 이사 **보수** | **집계만 저장.** 실명 행은 적재하지 않는다 |
| 이사 **경력** | **행 단위 저장(성명 포함)하되 관리자 전용 비공개** — 지원자가 갈 팀의 이사를 알고 싶어 한다는 이유 |
| 손익 원문 | `firm_income_statement_line` 유지 — 관심 밖 계정도 함께 들어오지만 재수집을 면한다 |
| 범위 밖 | 손해배상·소송·재무상태표·현금흐름표·자본변동표·주석·부속명세서 |

---

## 5. 데이터 모델

### 5.1 기존 테이블 — 컬럼 추가와 채움

```sql
-- firm_profile_yearly, firm_workforce_yearly 공통
alter table public.firm_profile_yearly
  add column if not exists fy_end_date     date,      -- 결산기준일 (2025.03 → 2025-03-31)
  add column if not exists fy_seq          smallint,  -- 기수 (제55기)
  add column if not exists source_rcept_dt date;      -- 채택한 공시 접수일
-- firm_workforce_yearly 에 같은 3개 + 아래 2개
alter table public.firm_workforce_yearly
  add column if not exists director_pay_total numeric,  -- SAL_TOTT + NSAL_TOT
  add column if not exists director_pay_count integer;   -- 보수 공시된 이사 수 (삼일 79)
```

| 컬럼 | 출처 |
|---|---|
| `revenue_total` / `_audit` / `_tax` / `_advisory` | `RVN_FY_SUM` / `RVN_FY_TOT1` / `_TOT2` / `_TOT3` |
| `operating_income` / `net_income` | 표준계정 `12500000010000` / `12900000010000` |
| `employee_total` | `HR_TOT_ALL` |
| `employee_audit` / `_tax` / `_advisory` | `BSAL_CFY_P_A` / `_P_T` / `_P_B` |
| `salary_total` / `salary_avg` | `BSAL_CFY_S_SUM` / (`_S_SUM` ÷ `_P_SUM`) |
| `director_count` | `HR_D_ALL` |
| `director_pay_total` / `_count` | `SAL_TOTT` + `NSAL_TOT` 합 / 행 수 |

> `RVN_FY_TOT4`(기타 소계)는 담을 칸이 없다. 합계와 3부문의 차로 남으므로 소실은 아니지만
> 화면에서 "감사+세무+자문 = 합계"로 표시하면 틀린다.

### 5.2 신규 테이블 — 공개

```sql
-- 임직원 비용. 개념별 1행, 매칭 방법을 함께 남긴다
create table public.firm_personnel_cost_yearly (
  cost_id      bigint generated always as identity primary key,
  firm_id      bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year    smallint not null,
  concept      text     not null check (concept in
                 ('personnel_total','welfare','travel','training','entertainment','quality_personnel')),
  segment      text     check (segment in ('audit','tax','advisory','other','total')),
  amount       numeric,                 -- 원 단위로 환산해 저장
  headcount    integer,                 -- personnel_total 의 부문별 인원
  source_table text     not null,       -- 'TG_BSAL' | 'TG_COST' | 'KCIS'
  match_method text     not null check (match_method in ('form_table','account_code','account_label')),
  source_rcept_no text  not null,
  constraint firm_personnel_cost_key unique (firm_id, bsns_year, concept, segment)
);

-- 손익계산서 원문 행 보존 (아카이브). 법인 간 비교에 쓰지 않는다
create table public.firm_income_statement_line (
  line_id       bigint generated always as identity primary key,
  firm_id       bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year     smallint not null,
  ord           integer  not null,   -- 원문 행 순서 = 계정 계층
  account_code  text     not null,   -- 표준계정코드. 비표준은 '99999999999999'
  is_standard   boolean  not null,
  account_label text     not null,   -- 원문 계정명 그대로
  amount        numeric,
  source_rcept_no text   not null,
  constraint firm_is_line_key unique (firm_id, bsns_year, ord)
);

-- 감사실적 총괄 (시장 × 개별/연결 × 회사수·의견분포)
create table public.firm_audit_record_yearly (
  record_id    bigint generated always as identity primary key,
  firm_id      bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year    smallint not null,
  fs_div       text     not null check (fs_div in ('separate','consolidated')),
  market       text     not null check (market in
                 ('kospi','kosdaq','konex','other_reporting','other')),
  client_count integer  check (client_count >= 0),
  opinion_unqualified integer, opinion_qualified  integer,
  opinion_adverse     integer, opinion_disclaimer integer,
  source_rcept_no text not null,
  constraint firm_audit_record_key unique (firm_id, bsns_year, fs_div, market)
);

-- 연결 감사대상 개별 명세 (TG_ARCD_C)
create table public.firm_audit_client (
  audit_client_id  bigint generated always as identity primary key,
  firm_id          bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year        smallint not null,
  seq_no           integer  not null,
  client_name      text     not null,   -- 원문 그대로
  subsidiary_count integer  check (subsidiary_count >= 0),
  adt_opinion      text     check (adt_opinion in ('적정','한정','부적정','의견거절')),
  adt_opinion_raw  text,
  source_rcept_no  text     not null,
  constraint firm_audit_client_key unique (firm_id, bsns_year, seq_no)
);

-- 회계사 경력·이동 (TG_HR_CR, TG_HR_CHG)
create table public.firm_cpa_tenure_yearly (
  tenure_id bigint generated always as identity primary key,
  firm_id   bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year smallint not null,
  segment   text     not null check (segment in ('audit','tax','advisory','other','total')),
  under_1y integer, y1_3 integer, y3_5 integer, y5_10 integer, y10_15 integer, over_15y integer,
  total    integer,
  hires    integer, leavers integer, begin_count integer, end_count integer,
  source_rcept_no text not null,
  constraint firm_cpa_tenure_key unique (firm_id, bsns_year, segment)
);

-- 감사투입 인력·시간 (TG_PUT)
create table public.firm_audit_input_yearly (
  input_id    bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  tenure_band text     not null check (tenure_band in
                ('trainee','under_1y','y1_3','y3_5','y5_10','y10_15','over_15y','total')),
  mid_headcount integer, mid_hours numeric,
  end_headcount integer, end_hours numeric,
  tot_headcount integer, tot_hours numeric,
  source_rcept_no text not null,
  constraint firm_audit_input_key unique (firm_id, bsns_year, tenure_band)
);

-- 품질관리 조직·인력 (TG_QLT)
create table public.firm_quality_staff (
  qstaff_id   bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  seq_no      integer  not null,
  dept_name   text,      -- QLT_NM
  duty        text,      -- QLT_WK
  headcount   integer,   -- QLT_CNT
  career_band text, staff_kind text, residency text, dedication text,
  source_rcept_no text not null,
  constraint firm_quality_staff_key unique (firm_id, bsns_year, seq_no)
);

-- 감리결과 (TG_ADRV 감사보고서 · TG_ADQLT 감사인)
create table public.firm_inspection_result (
  inspection_id   bigint generated always as identity primary key,
  firm_id         bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year       smallint not null,
  kind            text     not null check (kind in ('audit_report','auditor_quality')),
  seq_no          integer  not null,
  action_date     date,     -- 조치일자
  authority       text,     -- ADRV_NM '증권선물위원회'
  target_company  text,     -- ADRV_CP_NM (감사인 감리에는 없다)
  target_fy       text,     -- ADRV_FY '2014년12월말~2019년12월말' 원문 그대로
  qc_element      text,     -- ADQLT: 리더십/윤리/수용유지/인적자원/업무수행/모니터링
  finding_text    text,     -- ADRV_PO 또는 ADQLT_ADV_*
  action_text     text,     -- ADRV_ACP_STEP 또는 ADQLT_PFM_*
  cpa_action_text text,     -- ADRV_CPA_STEP
  source_rcept_no text not null,
  constraint firm_inspection_key unique (firm_id, bsns_year, kind, seq_no)
);

-- 이사 징계 (TG_DCP). 성명 칸은 적재하지 않는다
create table public.firm_director_discipline (
  discipline_id   bigint generated always as identity primary key,
  firm_id         bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year       smallint not null,
  seq_no          integer  not null,
  position        text,   -- DCP_PST
  discipline_date date,   -- DCP_DAY
  detail          text,   -- DCP_DTL
  note            text,
  source_rcept_no text not null,
  constraint firm_director_discipline_key unique (firm_id, bsns_year, seq_no)
);

-- 전문자격증 소지 현황 (TG_HR_CTF)
create table public.firm_certification_yearly (
  cert_id   bigint generated always as identity primary key,
  firm_id   bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year smallint not null,
  scope     text     not null check (scope in ('domestic','foreign')),
  cert_name text     not null,   -- 원문 그대로 '세무사(또는 세무대리업무)'
  headcount integer,
  source_rcept_no text not null,
  constraint firm_certification_key unique (firm_id, bsns_year, scope, cert_name)
);

-- 이사 경력 집계 (공개용. firm_director 에서 파생하며 개인은 드러나지 않는다)
create table public.firm_director_profile_yearly (
  dprofile_id bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  segment     text     not null check (segment in
                ('audit','tax','advisory','other','unclassified','total')),
  director_count       integer,
  tenure_months_avg    numeric, tenure_months_median numeric,
  practice_months_avg  numeric,
  invest_rate_max      numeric, invest_rate_top3     numeric,
  source_rcept_no text not null,
  constraint firm_director_profile_key unique (firm_id, bsns_year, segment)
);
```

`firm_income_statement_line` 은 **계정명을 정규화하지 않는다.** §3.1 대로 법인마다 계정이
달라 정규화가 성립하지 않고, 억지로 매핑하면 없는 비교가능성을 만들어 낸다. `ord` 로 원문
순서를 보존해 화면에서 그대로 재현하고 법인 **내** 연도 비교에만 쓴다.

`firm_inspection_result.finding_text` 는 문단 단위 서술이다. 주제 분류·태깅은 하지 않는다 —
P0 에서 KAM 에 적용한 "원문 보관 + 개수 세기" 원칙과 같다.

공개 테이블의 RLS 는 기존 공시 8종과 동일 — `anon`·`authenticated` SELECT 허용, 쓰기 정책
없음(`service_role` 만 적재). `docs/firm-platform-schema.md` §2 규칙 그대로다.

### 5.3 신규 테이블 — 관리자 전용

```sql
-- 이사 개인 명세 (TG_HR_ED)
create table public.firm_director (
  director_id bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  seq_no      integer  not null,
  name        text     not null,  -- ED_NM 원문 그대로
  position    text,               -- ED_PST '이사(대표이사)' / '사원'
  duty        text,               -- ED_BSN 원문
  segment     text check (segment in ('audit','tax','advisory','other','unclassified')),
  tenure_months   integer,        -- ED_WK_YM '36년 0개월' → 432
  practice_months integer,        -- ED_OP_YM
  invest_rate     numeric,        -- ED_IVST_RT (%)
  source_rcept_no text not null,
  constraint firm_director_key unique (firm_id, bsns_year, seq_no)
);

alter table public.firm_director enable row level security;
-- SELECT 정책을 만들지 않는다 → anon·authenticated 는 0행, service_role 만 읽는다
```

접근 통제를 **RLS 정책 부재**로 구현하는 이유: 정책이 하나도 없으면 비-`service_role` 은 한 행도
못 읽는다. 기존 프로젝트가 쓰기에 적용한 규칙(`docs/firm-platform-schema.md` §2 "쓰기 정책은
만들지 않는다")을 읽기에 그대로 적용하는 것이라 새 개념이 아니고, `user_cpa` 를 참조하는
정책보다 검증이 쉽다(정책 0건·RLS 켜짐만 확인하면 된다).

서버 접근 경로:

- 권한 검사는 **기존 `assertAdmin()` 재사용** (`lib/supabaseServer.ts:32`). `getUser()` 로 JWT 를
  검증한 뒤 `user_cpa.role === 'ADMIN'` 을 본다. 쿠키 위조 방지가 이미 들어 있다.
- 조회는 `getSupabaseAdmin()`(service_role). **`lib/firm/queries.ts` 에 넣지 않는다** — 그 모듈은
  첫 줄 주석대로 "공시 도메인은 anon SELECT 가 열려 있으므로 관리자 클라이언트를 쓰지
  않는다"는 전제 위에 있다. `lib/firm/adminQueries.ts` 를 새로 만들고 모든 함수가
  `assertAdmin()` 을 먼저 호출한다.
- 화면은 관리자 전용 라우트/탭. **RLS 만 믿지 않고 라우트에서도 `assertAdmin()` 을 건다** —
  service_role 은 RLS 를 우회하므로 라우트 검사가 실질적 방어선이다.

**이사 보수(`TG_SAL`·`NTG_SAL`)는 기존 결정대로 집계만 유지한다.** 이번 결정은 경력 정보에
대한 것이고 보수는 앞서 "집계만"으로 정한 항목이라 임의로 넓히지 않았다. 필요하면
`firm_director` 와 같은 구조·같은 통제로 확장할 수 있다.

### 5.4 `firm_registered` 확장 규칙

F004 목록에서 256곳을 발견해 마스터를 보강하되 **관측한 것만 쓴다.**

| 컬럼 | 처리 |
|---|---|
| `firm_name` · `dart_corp_code` | 공시의 `corp_name`·`corp_code` 그대로 |
| `registration_no` · `tier` | **건드리지 않는다.** F004 제출은 상장사 감사인 등록을 뜻하지 않는다 |
| `status` | 신규는 `active`. 이 값은 "수집 대상"이지 등록 상태가 아니다(기존 주석과 동일) |
| 기존 63곳 대조 | `dart_corp_code` 일치 → 동일 법인. 이름만 같고 코드가 다르면 **자동 병합하지 않고** 검토 목록으로 |

마스터가 63 → 256 으로 늘면 P0 의 `unmatchedAuditors` 상당수가 자동 해소되므로 수집 후
감사인 미매칭 재대조를 한 번 돌린다(Slice 8).

---

## 6. 파서가 지켜야 할 규칙

### 6.1 인코딩 — 선언을 믿지 않는다

2020년 접수분(삼일 20200929000485)은 XML 선언이 `encoding="utf-8"` 인데 실제는 EUC-KR 이다.
UTF-8 디코드 결과에 U+FFFD 가 나오면 EUC-KR 로 다시 디코드한다. 2024·2025 범위는 전부
UTF-8 이라 이번엔 안전망 용도다.

### 6.2 단위는 표마다·법인마다 다르다 — `TU` 칸을 읽는다

30곳 표본 실측:

| 표 | 원 | 천원 | 백만원 |
|---|---:|---:|---:|
| `TG_BSAL` | 6 | 16 | 8 |
| `TG_COST` | 4 | 19 | 7 |
| `KCIS:K` | 30 | 0 | 0 |

원 단위를 가정하면 최대 100만 배 틀린다. 각 `TABLE-GROUP` 의 `<TU>` 텍스트에서 배수를
확정하고, 단위 문구를 못 읽으면 **값을 버리고 검토 목록에 남긴다**(0 이나 원 단위로 추정 금지).

### 6.3 손익계산서의 당기 열 고르기

계정 행은 들여쓰기 때문에 빈 칸이 앞에 섞인다. **계정명 칸 다음의 첫 숫자 칸이 당기**다.
`Math.max` 로 고르면 매출이 줄어든 법인에서 전기를 집는다 — 이 실수로 처음 측정했을 때
"30곳 중 18곳만 일치"라는 잘못된 결론이 나왔고, 당기 열을 제대로 잡으니 **30/30 이 됐다.**

비표준 계정은 코드가 `99999999999999` 로 뭉개진다. 이번 범위의 상위 집계 계정은 전부
표준코드가 붙어 있으므로 `99999999999999` 행은 정규화 대상에서 제외하고 원문 보존만 한다.

### 6.4 값을 못 믿을 때

기존 수집기 원칙을 그대로 따른다.

- 없는 값은 **0 이 아니라 NULL**. `-` 는 결측이다.
- `ACODE` 가 없으면 라벨로 추측하지 않는다. 결측으로 두고 보고서에 남긴다.
- 서식 버전이 `6.0` 이 아니면 파싱하지 않고 보고서에 남긴다.
- 음수는 괄호 `(83112043)` · `△` · `-` 로 온다. 기존 `parseDartAmount` 가 처리한다.

---

## 7. 검증 규칙 — 하드 검사와 검토 신호를 구분한다

원문끼리 어긋나는 법인이 실제로 있고 우리가 고칠 수 없다. 전부 하드 검사로 걸면 멀쩡한
법인이 대량으로 적재 실패한다.

| 항등식 | 30곳 결과 | 취급 |
|---|---:|---|
| `RVN_FY_SUM` == 손익 영업수익 | **30 / 30** | **하드 검사.** 깨지면 파서 결함으로 보고 적재 보류 |
| `ARCD_C_FY_SUM` == `TG_ARCD_C` 행 수 | 삼일 629 == 629 | **하드 검사** |
| `BSAL_CFY_P_SUM` == `HR_TOT_ALL` | 26 / 30 | 검토 신호 — 적재하고 보고서 기록 |
| `BSAL_CFY_S_SUM` == `TG_COST.COST_ALL` | 24 / 30 | 검토 신호 |
| `CR_TOT_SUM` == `HR_END_SUM` | 삼일 2,813 == 2,813 | 검토 신호 |
| 시장별 `SADO_*_SUM` 합 == `ARCD_S_FY_SUM` | 삼일 일치 | 하드 검사 |
| `PUT_TOT_P_SUM` ≤ `HR_CPA_ALL` | 삼일 2,118 ≤ 3,073 | 검토 신호 |

어긋난 실례: 선민 인원 7 vs 27(제1기) · 신원 56 vs 57 · 가은 23 vs 26 · 회계법인 권 인건비
+12.8% · 원지 +23.6% · 서율 +8.6%. 대부분 기준일 차이로 보이나 원문만으로는 단정할 수 없다.

---

## 8. 그 밖의 함정

| 함정 | 근거 | 대응 |
|---|---|---|
| **기재정정 15%** | 2024·2025 접수 575건 중 87건. 안진은 2022년에 2020년분을 정정 | `(corp_code, 결산기준일)` 별 **접수일 최신 1건**만 채택. `rcept_no`·`rcept_dt` 를 함께 저장 |
| **결산월 제각각** | 3월 513 · 6월 54 · 그 외 8 | `bsns_year` = 결산기준일 연도, `fy_end_date` 별도 저장. `company.json` 의 `acc_mt` 로 교차확인 |
| **연도 축 불일치** | 삼일 제55기 = 2024-07~2025-06 | `firm_profile_yearly.bsns_year`(법인 결산)와 `firm_engagement.bsns_year`(고객사 사업연도)를 같은 축으로 조인하지 않는다. 화면 라벨을 구분 |
| **모집단 ≠ 등록감사인** | F004 제출 256곳은 "회계법인"이지 상장사 감사인 등록법인이 아니다 | `tier`·`registration_no` 를 추정하지 않는다 |
| **개별 감사대상 명단 없음** | 회사명이 있는 표는 연결(629사)뿐 | 기대치를 문서와 화면에 명시 |
| **회사명 자동 연결 금지** | 원문 표기는 `(주)`·공백·법인격이 제각각 | `firm_audit_client.client_name` 을 `firm_company` 에 자동 연결하지 않는다. 대조 **보고서**만 낸다 |

---

## 9. 구현

### 9.1 파일 구조

```
scripts/firm_collector/
  dartClient.ts           (기존) + listFilings() · fetchDocument()
  dartXml.ts              (신규) ZIP→XML 디코드, TABLE-GROUP/ACODE 인덱싱, TU 단위 추출
  annualReportParse.ts    (신규) 순수 함수. 인덱스 → 도메인 값
  collectAnnualReports.ts (신규) 파이프라인
  run.ts                  (기존) + annual-reports 명령
lib/firm/
  adminQueries.ts         (신규) 관리자 전용 조회. 모든 함수가 assertAdmin() 선행
```

`dartXml.ts` 의 중간 표현:

```ts
interface ParsedDocument {
  companyName: string;
  formulaVersion: string;                 // '6.0'
  groups: Map<string, TableGroup>;        // ACLASS → 표 그룹
}
interface TableGroup {
  unitMultiplier: number | null;          // TU 에서 확정. null 이면 값을 쓰지 않는다
  unitRaw: string | null;
  rows: Cell[][];
  byCode: Map<string, Cell[]>;            // ACODE → 칸들 (중복 코드는 순서 보존)
}
interface Cell { code: string | null; text: string; }
```

`annualReportParse.ts` 는 네트워크·DB를 모른다 — `normalize.ts` 와 같은 규약이라 픽스처로
검증할 수 있다.

### 9.2 재사용할 기존 코드

| 쓸 것 | 위치 |
|---|---|
| `readZipEntries` | `scripts/firm_collector/zip.ts:31` |
| `parseDartAmount`(괄호·△·`-`) · `parseDartCount` | `scripts/firm_collector/normalize.ts:19,54` |
| `normalizeAuditOpinion` · `normalizeFirmName` · `buildFirmIndex` · `matchFirm` | `normalize.ts:68,88,110,135` |
| `parseDartDate` | `normalize.ts:146` |
| `classifyFirmSegment`(담당업무 → audit/tax/advisory/other) | `normalize.ts:378` |
| `firmCorpCandidates`(전체 법인명 대조) | `scripts/firm_collector/responseMapping.ts` |
| `createStoreClient` · `upsertFirmProfile` · `upsertFirmWorkforce` · `backfillFirmCorpCode` | `scripts/firm_collector/store.ts` |
| 캐시·스로틀·재시도·`DartError` 처리 | `scripts/firm_collector/dartClient.ts` |
| CLI 규약 `--year/--limit/--corp/--report/--resume/--retry-from` | `scripts/firm_collector/run.ts:34` |
| **`assertAdmin()`** — `getUser()` 검증 + `user_cpa.role === 'ADMIN'` | `lib/supabaseServer.ts:32` |
| `getSupabaseAdmin()`(service_role) | `lib/supabaseAdmin.ts` |
| 픽스처 테스트 패턴 | `tests/firmCollector.test.ts` |

### 9.3 캐시와 호출량

`DART_CACHE_DIR` 규약을 이어쓴다. `document.xml` 의 **ZIP 원본**을 `rcept_no` 키로 저장해야
파서를 고친 뒤 네트워크 없이 전량 재파싱할 수 있다. 256곳 × 2년 ≈ 530개, 평균 50KB → 약 30MB.
캐시 경로는 이미 gitignore 대상이다.

API 호출량은 목록 약 20건 + 원문 약 530건으로 일일 한도(20,000)의 3% 미만이다.

### 9.4 슬라이스

각 슬라이스는 독립적으로 커밋 가능하고, 끝에 `npm run typecheck` · `npm test` 를 돌린다.

**Slice 1 — 공시 목록·마스터 보강**
`dartClient.listFilings()`(3개월 창 분할·페이지 순회) 추가. F004 전수 조회 →
`(corp_code, 결산기준일)` 별 최신 1건 선정 → `firm_registered` upsert(§5.4 규칙) →
`company.json` 으로 `acc_mt`·`induty_code` 백필.
*인수*: 256곳 이상 반영. 기존 63곳과 코드 불일치가 0 이거나 전부 보고서에 기록된다.

**Slice 2 — 원문 취득·XML 인덱서**
`fetchDocument()`, 인코딩 판별, `dartXml.ts`, `TU` 단위 추출.
*인수*: 표본 31건(대형~제1기 소형 + 2020 EUC-KR)에서 표 그룹 41개가 모두 잡히고 법인명이
깨지지 않으며, 단위가 원/천원/백만원으로 정확히 분류된다.

**Slice 3 — 매출·손익·임직원 비용**
`TG_RVN_DTL` → `revenue_*`. `KCIS:K` 표준계정 → `operating_income`·`net_income` +
`firm_income_statement_line` 전 행. `TG_BSAL`·`TG_COST` + 표준코드 4종 →
`firm_personnel_cost_yearly`.
*인수*: `RVN_FY_SUM == 영업수익` 이 표본 30/30 통과. 당기 열 선택이 매출 감소 법인에서도 정확.
단위 환산 후 삼일 인건비 795,751,178,314 원 재현. 선민(제1기, 전기 전부 `-`)이 0 이 아니라 NULL.

**Slice 4 — 인력(공개)**
`TG_HR_TOT`·`TG_BSAL`(인원)·`TG_HR_CR`·`TG_HR_CHG` → 기존 두 테이블 + `firm_cpa_tenure_yearly`.
`TG_DCP` → `firm_director_discipline`(성명 제외). `TG_HR_CTF` → `firm_certification_yearly`.
`SAL_TOTT`+`NSAL_TOT` → `director_pay_*`.
*인수*: `salary_per_employee` 가 전 임직원 기준으로 계산된다. 표본 30곳에서 총괄·변동·경력·
부문별 4개 표가 30/30 적재되고, 이사 보수는 8곳만 채워지며 나머지는 0 이 아니라 NULL.
**이사 보수표의 개인 실명이 공개 테이블·보고서·캐시 어디에도 없다**(문자열 검사).

**Slice 5 — 이사 명세(관리자 전용)**
`TG_HR_ED` → `firm_director`(행 단위, 성명 포함, SELECT 정책 없음) +
`firm_director_profile_yearly`(공개용 집계). `ED_WK_YM` '36년 0개월' → 개월 수 파싱,
`ED_BSN` → `classifyFirmSegment` 로 부문 분류. `lib/firm/adminQueries.ts` 신설.
관리자 전용 라우트에서도 `assertAdmin()`.
*인수*: anon·authenticated 세션으로 `firm_director` 조회 시 **0행**. 관리자 세션은 조회된다.
비관리자의 관리자 라우트 접근은 거부된다. 공개 집계만으로는 개인이 특정되지 않는다.

**Slice 6 — 감사실적**
`TG_ARCD_TOT/SADO/SRA/SA` → `firm_audit_record_yearly`. `TG_ARCD_C` → `firm_audit_client`
(`normalizeAuditOpinion` 재사용).
*인수*: `ARCD_C_FY_SUM` == 적재 행 수. 시장별 의견 합 == 개별감사 합계.

**Slice 7 — 품질관리·감리결과**
`TG_PUT` → `firm_audit_input_yearly`. `TG_QLT` → `firm_quality_staff`.
`TG_COST` → `firm_personnel_cost_yearly`(quality_personnel). `TG_ADRV`·`TG_ADQLT` →
`firm_inspection_result`.
*인수*: 삼일 감사투입 2,142,905시간·품질관리 비중 2.33% 재현. 감리 서술문이 잘리지 않는다.

**Slice 8 — 전량 수집·교차 검증**
`run.ts annual-reports --year 2024|2025 --resume --retry-from`. 보강된 마스터로
`reconcileAuditors.ts` 재실행. `firm_audit_client` ↔ `firm_engagement` 대조 보고.
*인수*: 각 법인·연도가 적재·미제출·정합실패·오류 중 하나로 설명된다. 설명 없는 건 0.

**Slice 9 — 문서화**
`scripts/firm_collector/README.md`(명령·보고서 항목·한계) ·
`docs/firm-platform-schema.md`(신규 테이블 12개, §4 "남은 판단거리" 갱신) ·
`docs/reports/` 수집 결과 보고서 · 그리고 **이 계획서에 실제 구현과 달라진 점을 반영**한다.

---

## 10. 검증 절차

```bash
npm run typecheck && npm test
```

1. **픽스처 테스트** (`tests/firmAnnualReport.test.ts`) — 실제 원문을 축약해 4종 보관:
   대형(삼일) · 제1기 소형(선민, 음수·`-` 결측 포함) · 단위가 천원/백만원인 법인 ·
   2020년 EUC-KR. 네트워크 없이 순수 함수만 검증한다.
2. **원문 내부 정합** — §7 의 하드 검사는 실패 시 적재 보류, 검토 신호는 적재하되 보고서
   `consistencyWarnings` 에 기록.
3. **캐시 전량 재파싱 대조** — 저장된 ZIP 530개에 현재 파서를 다시 적용해 DB 값과 대조한다
   (P0 에서 5,546건에 했던 방식). 불일치 0 이어야 한다.
4. **손계산 대조** — 삼일·삼정·선민 3곳을 DART 원문 화면과 눈으로 대조.
5. **개인정보 검사** — 공개 테이블 덤프·보고서 JSON·캐시 JSON 에서 `TG_SAL` 이사 성명이
   하나도 없는지 문자열 검색. 성명은 `firm_director` 한 곳에만 존재해야 한다.
6. **관리자 전용 접근 검사** — 세 가지를 실제로 확인한다.
   - anon 키 세션으로 `firm_director` SELECT → **0행**
   - 로그인한 비관리자 세션 → **0행**, 관리자 라우트 접근 → 거부
   - 관리자 세션 → 정상 조회

   `pg_policies` 에 `firm_director` 정책이 0건인지, `pg_class.relrowsecurity` 가 true 인지도
   함께 확인한다(`docs/firm-platform-schema.md` §3-2 의 점검 방식).
7. **뷰 회귀** — `supabase/verification/verify_firm_views.sql` 재실행. 특히
   `salary_per_employee`·`revenue_per_employee`·`audit_revenue_ratio` 가 실제 값으로 나오는지.

---

## 11. 가정과 미확정 사항

1. **`bsns_year` = 결산기준일의 연도**로 정의한다. 삼일(6월 결산) 제55기는 2025 다. 같은
   `bsns_year` 라도 법인마다 대상 기간이 다르고 고객사 사업연도와도 어긋난다(§8). 화면
   라벨을 어떻게 쓸지는 결정 전이다.
2. **`RVN_FY_TOT4`(기타 소계)를 어디에 둘지** — 컬럼 추가 대 화면에서 잔차 표시 — 는
   Slice 3 에서 정한다.
3. **256곳 전부가 2년치를 냈다고 가정하지 않는다.** 신설·해산 법인이 있고 결산월도 다르다.
   미제출은 오류가 아니라 결측이다.
4. **`TG_HR_ED` 의 소형 법인 재식별 위험.** 이사가 몇 명뿐인 법인은 출자비율만으로 개인이
   특정될 수 있다. 공개 집계(`firm_director_profile_yearly`)를 화면에 붙일 때
   `director_count` 가 작은 법인의 `invest_rate_*` 노출 여부를 다시 본다.
5. **업무추진비의 `account_label` 매칭.** 표준코드가 23/30 이라 나머지는 계정명으로 잡는다.
   `match_method='account_label'` 로 표시해 신뢰도를 구분하고, 순위 지표에 쓸지는 보류한다.
6. **서식 v1.4(2022년 이전)는 범위 밖이다.** `NTG_SAL` 이 없는 등 차이가 있고 2024·2025
   접수분에는 나타나지 않았다.

## 12. 후속으로 미룰 항목

- 손해배상준비금·공동기금(`TG_CPST_SV`·`TG_CPST_ISRC`) · 소송 현황(`TG_SVIT`)
- 재무상태표·현금흐름표·자본변동표·주석(`KCBS:K`·`KCCF:K`·`KCEF`·`KCRE:K`)
- 부속명세서 — 차입금·타법인 출자·채무보증
- 외국 회계법인 제휴·해외 감독기구 등록(`TG_ALC_FCP`·`TG_FACR`·`TG_FMLC`)
- 일반관리비 등 법인 간 비교가 성립하지 않는 비용 계정의 정규화
- 2023년 이전 소급 수집
- 감사인 등록번호와 군(tier) — 이 공시에 없어 별도 출처가 필요하다

## 13. 구현 시 확정한 보완 사항

아래는 위 초안과 충돌할 때 우선하는 실제 구현 기준이다.

1. **보수 합계 키**: 실명 `SAL_TOTT`, 마스킹 `NSAL_TOTT`. `NSAL_TOT`는 개인별 금액이므로 합계 키로 쓰지 않는다.
2. **개인 보수 보관**: 추가 사용자 지시에 따라 실명/마스킹 원문을 `firm_director_pay`에 보존한다. `firm_director`와 동일하게 RLS 활성화·공개 SELECT 정책 없음, 관리자 라우트와 함수에서 권한을 확인한다. 공개 집계/보고서에서만 이름 유출을 검사하며 승인된 원본 ZIP은 제외한다.
3. **기타 부문**: `revenue_other`, `employee_other`를 추가해 원문 기타 소계를 보존한다. 0과 `-`를 섞거나 잔차로 값을 만들어내지 않는다.
4. **모델에 빠진 집계 칸**: `firm_annual_form_cell`에 허용된 집계 표의 서식키·원문 값·단위를 보존한다. 주/분사무소·상시/비상시 인력, 전기/전전기 보수, 자산규모/연차별 실적이 여기 포함된다. 개인 명세 표는 허용하지 않는다.
5. **교체 원자성**: 프로필·인력·명세를 법인/결산연도 단위 RPC로 한 트랜잭션에 적재한다. 중간 실패는 전체 롤백한다. `firm_annual_collection`에 접수일·파서 버전·해시·검토 신호를 저장한다.
6. **연도 축**: 기존 고객사 뷰에서 자체 지표를 분리한다. `v_firm_annual_summary`는 회계법인 결산기만 조인하며 화면에 실제 보고기간을 표시한다. 고객사 `year`와 회계법인 `fy_year`는 독립적이다.
7. **복수 결산기**: 현대회계법인 2024의 3월·6월 결산 두 기수는 기존 연도 유일키로 모두 저장할 수 없으므로 자동 선택하지 않고 보류한다.
8. **소규모 공개 집계**: 이사 경력 표 5명 미만 그룹의 경력 통계는 NULL, 출자비율 집계는 규모와 무관하게 NULL로 유지한다. 이름이 없어도 개인 값을 그대로 공개하는 것을 방지한다. 개인 값은 관리자 명세에서 확인한다.
9. **손익 당기 열**: `과목` 행의 첫 기수 열 경계 안에서 첫 금액을 읽는다. 표 제목의 “당기”를 열 헤더로 오인하지 않는다. 아성 2025처럼 첫 열이 원문에서 `(전)`으로 잘못 표기된 경우 원문 검토 신호를 남긴다. 당기 `-`를 건너뛰어 전기 숫자를 읽지 않는다.
10. **검증 단계 구분**: PGlite 테스트 DB의 역할/RLS 검증과 실제 운영 DB·로그인 세션 검증은 구분해 보고한다. 신규 테이블은 당초 12개에서 위 보완 3개를 더한 15개다.
11. **접수 기준일**: 사용자 추가 지시에 따라 기본 조회 범위를 2024-01-01~실행 당일(Asia/Seoul)로 확대한다. 목록은 캐시로 건너뛰지 않고 매번 조회하며 최신 완료 목록과 범위를 보관한다. 적재 결산연도 2024·2025와 접수연도를 혼동하지 않는다. 2026-09-08 추가분 253건(2023 결산 1건, 2024 결산 1건, 2025 결산 3건, 2026 결산 248건)은 원문 확인을 완료했으며 대상 외 결산분은 운영 적재에 포함하지 않았다.
12. **후속 범위 승인**: §13.11의 당시 적재 범위를 다시 확대해 2024·2025·2026을 처리한다. 1.8 최신 후보 231문서의 수집 대상 필드 키와 단위가 기존 매핑과 호환됨을 검증해 지원 버전에 추가했다. 1.4 등 나머지 버전은 거부한다. 현대 2024 복수 결산기 2문서는 별도 보류하며 결산기 키 확장은 이번 작업에 포함하지 않는다.
13. **운영 반영 경로**: Supabase MCP `apply_migration`으로 기본 F004 스키마와 2026 확장 RPC를 적용한다. 이후 적재·전량 대조는 기존 service_role API로 실행한다. 직접 연결 방식을 선택한 경우에만 `DATABASE_URL`이 필요하다.
14. **현대 제20기 제외(사용자 후속 결정)**: “이경우에 20기는 무시하자”에 따라 현대회계법인(00561352)의 결산일 2024-06-30 공시를 선정·집계에서 제외한다. 같은 기수의 이후 정정공시에도 적용한다. 제19기(2023-04-01~2024-03-31)를 2024 결산분으로 적재하고 제21기는 유지한다. §13.7·12의 현대 보류는 이 결정으로 해소됐다. 원본 캐시와 제외 근거는 보존하며 일반적인 복수 결산기 보류 규칙은 유지한다.
15. **실적 기준연도 변경(사용자 후속 결정)**: 회계법인 실적은 보고기간 시작연도(`fy_start_year`)를 기준으로 분석·표시한다. 종료연도를 일괄 차감하지 않고 원문 `fy_start_date`에서 계산한다. 기존 `bsns_year`와 CLI `--year`는 명세 연결·공시 탐색용 결산말 연도 키로만 유지한다. §8·11 등 이전의 분석 기준 설명은 이 규칙으로 대체한다. 현대 제19기는 2023년 시작 실적, 제21기는 2024년 시작 실적이며 제20기 제외는 유지한다. 같은 시작연도에 여러 기수가 있는 4법인은 합산하거나 덮어쓰지 않고 기간별로 표시한다. 고객사 사업연도와 실제 감사대상 기간의 자동 연결은 하지 않는다.
