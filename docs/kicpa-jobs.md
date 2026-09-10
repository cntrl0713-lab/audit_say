# KICPA 채용공고와 카카오 채널 알림 준비

기준일: 2026-09-09. 원안은 [사용자 제공 계획](plans/kicpa-jobs-alert-plan.md)에 보존한다. 실제 구현 기준은 이 문서다.

## 이번에 확정한 범위

- 카카오 ‘나에게 보내기’에서 **채널 알림톡을 준비하는 방향**으로 변경한다. 별도 카카오 OAuth와 개인 메시지 토큰은 사용하지 않는다.
- 사업자등록과 발송업체 선정은 사용자가 나중에 결정한다. 특정 업체 SDK·키·계약에 의존하지 않는다.
- 공고 수집 기반, 전체·법인별 조회, 회원의 수신 희망·게시판 선택·반복 안내 동의 저장, 발송 기록과 업체 연결 인터페이스를 구현한다.
- 지금 설정을 저장해도 실제 메시지는 발송되지 않는다. 서비스 준비와 휴대전화 인증 이후 시작한다. 이번 화면/API에서는 전화번호를 수집하지 않는다.
- 수습CPA 게시판의 일반 공고 전체와 CPA 구인게시판의 제목에 `수습` 또는 `신입`이 포함된 공고를 수집한다. 공지글은 제외한다.
- 매일 한국시간 **08:30 이상 18:30 미만**에만 KICPA를 요청한다. 예약 실행은 08:30~18:25, 5분 간격이다. 지연 실행·수동 실행·페이지 이동·재시도·리다이렉트에도 요청 직전 시간을 검사한다.

GitHub Actions의 5분 예약은 5분 내 감지를 보장하지 않는다. 지연·누락이 가능하고 공개 저장소는 60일간 활동이 없으면 예약 실행이 비활성화될 수 있다. 저장소 공개 여부와 사용 요금제에 따라 실행 비용도 확인해야 한다. [GitHub 예약 실행 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## 현재 가능한 것과 남은 것

| 영역 | 상태 |
| --- | --- |
| 공고 저장·중복 방지·최초 수집 기준 | SQL 및 로컬 DB 테스트 준비 |
| 전체 `/jobs`, 법인별 `?tab=jobs` | 조회 화면 구현, 운영 데이터 적재 전 |
| `/settings` | 회원의 신청 설정 저장 구현, 발송 준비 중 표시 |
| HTML/JSON 파서·시간 제한 | 합성 자료로 검증, 실제 게시판 구조는 미확인 |
| 발송 처리 | 업체 공통 인터페이스와 오프라인 가짜 발송기 검증 |
| 실제 발송 | 기본 발송기에서 차단. 환경변수만 바꿔도 실행 불가 |
| 운영 DB·배포·예약 실행 | 이번 작업에서 적용·활성화하지 않음 |

수집 주소는 사용자가 제공했다.

- [수습CPA 게시판](https://www.kicpa.or.kr/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu07.page)
- [CPA 구인게시판](https://www.kicpa.or.kr/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu01.page)

작업 시간이 한국시간 22시 이후여서 **KICPA 사이트에 접속하지 않았다.** `tests/fixtures/kicpa-jobs`는 합성 자료이며 실제 사이트 구조의 증거가 아니다. 검증된 설정과 명시적인 활성화 조건이 없으면 실제 수집을 거부한다. 합성 설정은 검증 플래그를 켜도 운영 수집에 사용할 수 없다.

허용 시간에 실제 목록 HTML 또는 목록을 제공하는 JSON 응답, 게시글 번호·제목·회사·게시일·마감·원문 링크·공지 표시·빈 목록·페이지 이동을 확인해야 한다. 목록이 최신순으로 안정적으로 정렬되는지 확인한 뒤 이미 수집한 구간에서 탐색을 종료하는 최적화를 검토한다. 현재 구현은 설정된 목록의 마지막 페이지까지 검증하므로, 운영 전 페이지 수와 요청량을 확인해야 한다. 페이지 순환·한도 초과·구조 변경은 일부 목록으로 기준을 초기화하지 않고 해당 게시판 저장을 중단한다.

## 데이터와 접근 권한

마이그레이션: [`20260909010000_kicpa_jobs.sql`](../supabase/migrations/20260909010000_kicpa_jobs.sql). 아직 적용하지 않은 이번 기능의 신규 마이그레이션을 변경한 것이며, 이미 적용한 마이그레이션을 재작성하는 운영 절차로 사용하지 않는다.

| 객체 | 역할 | 접근 |
| --- | --- | --- |
| `cpa_kicpa_jobs` | 공고, 원문, 법인 연결 | anon/authenticated 읽기, service_role 쓰기 |
| `cpa_kicpa_job_boards` | 게시판별 최초 수집 기준과 확인 시각 | service_role |
| `cpa_kicpa_jobs_subscribers` | 신청 설정, 현재 동의 버전·시각, 추후 인증번호 저장 필드 | service_role |
| `cpa_kicpa_job_deliveries` | 공고·구독자별 처리 상태 | service_role |
| `cpa_kicpa_jobs_subscription_status` | 본인의 희망 상태·선택 게시판·동의 갱신 필요 여부 | authenticated 본인만 |

공고 식별자는 `(board, id)`다. 법인명/별칭이 정규화 후 정확히 하나의 법인에 대응할 때만 연결하며, 모호한 공고도 전체 목록에는 남긴다. 공고 URL은 KICPA의 HTTPS 주소만 허용한다.

구독 상태 뷰는 소유자 권한으로 기본 테이블을 읽되 `auth.uid()`로 본인 행만 허용하고 익명 인증 사용자를 제외한다. 전화번호와 발송 기록은 뷰/API에 노출하지 않는다. 예약된 전화번호 필드는 현재 비워 둔다. 추후 서버에서 수신번호 인증을 완료한 경우에만 번호와 인증시각을 함께 저장한다.

`is_active`는 수신 희망 상태다. 실제 발송 가능 여부를 뜻하지 않는다. 큐 등록과 처리에는 다음 조건이 모두 필요하다.

1. 수신 희망이 켜져 있다.
2. 현재 동의 버전과 동의 시각이 저장돼 있다.
3. 수신번호와 인증시각이 저장돼 있다.
4. 공고가 선택한 게시판에 해당하고 수신 시작시점 이후에 감지됐다.

현재 동의 버전은 `2026-09-09-v1`이다. 문구의 정본은 [`lib/kicpa/subscription.ts`](../lib/kicpa/subscription.ts)다. 버전을 바꾸면 SQL의 큐 조건과 Python 발송 전 검사도 함께 변경해야 한다. 현재 구현은 최신 신청 상태와 동의 기록을 저장한다. 발송 서비스 출시 시 과거 동의·철회 증빙의 보존 범위와 개인정보 처리·위탁 안내를 확정한다.

## 구독 API와 화면

- `/jobs`: 최신 공고 50건과 원문, 연결된 법인 링크.
- `/firms/[firm_id]?tab=jobs`: 법인에 연결된 공고. 재무자료와 연도 선택에 의존하지 않는다.
- `/settings`: 로그인 후 게시판 선택, 수신 희망, 반복 안내 동의, 설정 저장·삭제. 준비 상태를 명시한다.
- `GET /api/jobs/subscription`: 본인의 공개 가능한 상태만 반환.
- `PATCH /api/jobs/subscription`: `{active, boards, consent}`만 허용. 활성화에 필요한 현재 동의가 없으면 명시적 동의를 요구한다.
- `DELETE /api/jobs/subscription`: 신청과 해당 발송 기록 삭제.

응답은 `{saved, active, boards, consentRequired, deliveryStatus: 'preparing'}`다. 휴대전화나 인증시각은 포함하지 않는다. 변경 요청은 같은 출처만 허용하고 실제 로그인 회원을 검증한다. 익명 학습 세션은 사용할 수 없다.

수신 재개·유효 동의 갱신·활성 게시판 변경 시 시작시각을 갱신하여 과거 대기 공고가 다시 살아나지 않게 한다. 이미 외부 업체에 전달 중인 요청을 설정 변경으로 회수할 수는 없다.

## 수집과 발송 처리

검증된 게시판 목록과 신규 발송 큐는 `ingest_cpa_kicpa_jobs`에서 함께 저장한다. 최초 목록은 기준 자료로만 저장하며 과거 공고를 발송하지 않는다. 이후 새로운 공고의 적격 구독자별 큐를 만들고 `(job_board, job_id, subscriber_id)`로 중복을 막는다.

업체 연결은 [`providers.py`](../scripts/kicpa_jobs/providers.py)의 `NotificationProvider`를 구현하는 지점으로 모았다. 현재 `configured_provider()`는 항상 `DisabledProvider`를 반환한다. 따라서 환경변수를 켜도 실제 발송이 시작되지 않고 큐를 가져오거나 변경하지도 않는다. `FakeProvider`는 테스트 입력만 처리하며 HTTP 요청이나 업체 키를 사용하지 않는다.

| 상태 | 의미와 재처리 |
| --- | --- |
| `pending` | 처리 대기 |
| `sending` | 한 작업이 처리 중 |
| `accepted` | 업체 접수만 확인. 성공 집계·자동 재시도 제외 |
| `sent` | 실제 전달 성공 확인 |
| `failed` | 발송하지 않았음이 확인된 실패. 지연 후 최대 5회 시도 |
| `uncertain` | 성공 여부를 알 수 없음. 중복 방지를 위해 자동 재시도 제외 |
| `cancelled` | 신청 중단 또는 수신 조건 불충족 |

15분 이상 중단된 `sending`도 `uncertain`으로 바꾼다. 업체 접수에는 `provider_message_id`가 필요하다. 업체를 연결할 때 인증된 콜백 또는 결과 조회를 구현하여 `accepted`를 최종 결과로 확정해야 한다. 현재는 그 외부 연결을 구현하지 않았다.

`notified_at`은 모든 구독자의 성공이 확인됐을 때만 채우는 보조 집계다. NULL을 미발송 대상 검색 조건으로 사용하지 않는다. 공고 행을 먼저 잠근 뒤 완료 기록을 변경하여 여러 수신자가 동시에 완료될 때 집계 누락을 방지한다. DB와 외부 업체 사이에 하나의 트랜잭션은 없으므로 정확히 한 번의 외부 전달을 보장하지 않으며 업체의 멱등성 지원을 연동 시 확인한다.

## 실행 설정

| 설정 | 위치 | 용도 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | 기존 앱 설정 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | 기존 앱 설정 |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel 서버 / GitHub Secret | 구독 저장 / 수집 저장 |
| `SUPABASE_URL` | GitHub Secret | 수집 대상 DB |
| `KICPA_SCRAPER_ENABLED` | GitHub Variable | `true`일 때 예약 작업 허용. 현재 미활성 |
| `KICPA_BOARD_CONFIG` | GitHub Variable / CLI 환경 | 검증한 설정 파일의 저장소 경로 |
| `KICPA_BOARD_LAYOUT_VERIFIED` | GitHub Variable | 실제 구조 확인 후 `true` |
| `KICPA_NOTIFICATIONS_ENABLED` | GitHub Variable | 향후 발송 기능용. 현재 업체 구현이 없어 발송 불가 |
| `KICPA_APP_ORIGIN` | GitHub Variable | 향후 메시지에서 사용할 서비스 HTTPS 출처 |

이 기능에는 `KAKAO_REST_API_KEY`, 개인 `talk_message` 동의, OAuth 콜백, 개인 토큰이 필요하지 않다. 기존 카카오 앱을 다른 로그인 기능에 사용할지는 별도 결정이다. 키는 채팅·저장소·로그에 기록하지 않는다.

## 로컬 검증

운영 DB·KICPA·메시지 업체에 접속하지 않는 검사:

```powershell
python -m pip install -r scripts/kicpa_jobs/requirements.txt
python -m unittest discover -s tests -p 'test_kicpa*.py'
python scripts/kicpa_scraper.py --dry-run --config tests/fixtures/kicpa-jobs/synthetic-config.json
python scripts/kicpa_scraper.py --config tests/fixtures/kicpa-jobs/synthetic-config.json --fixture tests/fixtures/kicpa-jobs/synthetic-trainee.html --board trainee_cpa
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/kicpaJobsDatabase.test.ts tests/kicpaJobsLinks.test.ts tests/firmDetailView.test.ts tests/kicpaSubscription.test.ts tests/kicpaSubscriptionRoutes.test.ts
npm run typecheck -- --incremental false
```

의존성 설치에는 패키지 저장소 접속이 필요하다. 그 아래 검사는 합성 자료·가짜 HTTP·로컬 PGlite를 사용한다.

2026-09-09 검증 결과: 위 Node 테스트 39개, Python 테스트 34개, 전체 TypeScript 타입 검사와 변경 파일 ESLint가 통과했다. Python 검사에는 리다이렉트 최종 주소를 기준으로 상대 링크를 해석하는 회귀 사례도 포함한다. 권한·큐 처리·설정 API와 수집 시간 제한을 로컬에서 확인했으며, 실제 KICPA 응답·운영 DB·휴대전화 전달은 검증하지 않았다. 다중 DB 연결의 동시 완료는 별도 부하 테스트로 재현하지 않았다.

## 후속 연결 순서

1. 한국시간 허용 구간에 KICPA 실제 응답을 확인하고 파서 설정·페이지 범위를 확정한다.
2. 운영 DB 마이그레이션, 앱 배포와 수집 환경 설정 후 최초 기준 적재·후속 신규 감지를 확인한다. 검증 후 수집 예약을 활성화한다.
3. 사용자가 사업자등록과 업체를 결정하면 비즈니스 채널·휴대전화 인증·개인정보 안내를 연결한다.
4. [알림톡 심사 준비안](kicpa-alimtalk-template.md)을 실제 승인 형식으로 확정하고 신청한다. 승인 가능성을 현재 보장하지 않는다.
5. 승인된 템플릿 어댑터, 업체 요청 인증·멱등성, 접수 후 최종 결과 조회/콜백을 구현하고 테스트 수신자로 확인한 다음 발송을 활성화한다.

하루 묶음 발송이나 법인·지역별 추가 조건은 이번 구현에 포함하지 않는다. 현재 기준은 사용자가 선택한 게시판에 해당하는 신규 공고 한 건당 한 번이다.
