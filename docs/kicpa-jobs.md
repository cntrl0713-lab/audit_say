# KICPA 채용공고와 카카오 채널 알림 준비

기준일: 2026-09-10. 원안은 [사용자 제공 계획](plans/kicpa-jobs-alert-plan.md)에 보존한다. 실제 구현 기준은 이 문서다.

## 이번에 확정한 범위

- 카카오 ‘나에게 보내기’에서 **채널 알림톡을 준비하는 방향**으로 변경한다. 별도 카카오 OAuth와 개인 메시지 토큰은 사용하지 않는다.
- 사업자등록과 발송업체 선정은 사용자가 나중에 결정한다. 특정 업체 SDK·키·계약에 의존하지 않는다.
- 공고 수집 기반, 전체·법인별 조회, 회원의 수신 희망·게시판 선택·반복 안내 동의 저장, 발송 기록과 업체 연결 인터페이스를 구현한다.
- 지금 설정을 저장해도 실제 메시지는 발송되지 않는다. 서비스 준비와 휴대전화 인증 이후 시작한다. 이번 화면/API에서는 전화번호를 수집하지 않는다.
- 수습CPA 게시판의 일반 공고 전체와 CPA 구인게시판의 제목에 `수습` 또는 `신입`이 포함된 공고를 수집한다. 공지글은 제외한다.
- 수집하는 공고 정보는 **제목·회사명·게시일·원문 링크**(`title`, `company`, `posted_at`, `source_url`)뿐이다. 화면에서는 제목을 클릭하면 원문이 열린다. 식별·연결·정렬에 필요한 `board`, `id`, `firm_id`, `created_at`은 내부 필드로 유지한다.
- 마감일, 공고 본문, 연락처, 이메일, 첨부파일은 수집하지 않는다. 지원 방법과 마감 여부는 사용자가 원문에서 확인한다. 알림톡도 제목·회사명·게시일과 원문 확인 버튼으로 구성한다.
- 매일 한국시간 **08:30 이상 18:30 미만**에만 KICPA를 요청한다. 예약 실행은 08:30~18:25, 5분 간격이다. 지연 실행·수동 실행·페이지 이동·재시도·리다이렉트에도 요청 직전 시간을 검사한다.

GitHub Actions의 5분 예약은 5분 내 감지를 보장하지 않는다. 지연·누락이 가능하고 공개 저장소는 60일간 활동이 없으면 예약 실행이 비활성화될 수 있다. 저장소 공개 여부와 사용 요금제에 따라 실행 비용도 확인해야 한다. [GitHub 예약 실행 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## 현재 가능한 것과 남은 것

| 영역 | 상태 |
| --- | --- |
| 공고 저장·중복 방지·최초 수집 기준 | SQL 및 로컬 DB 테스트 준비 |
| 전체 `/jobs`, 법인별 `?tab=jobs` | 조회 화면 구현, 운영 데이터 적재 전 |
| `/settings` | 회원의 신청 설정 저장 구현, 발송 준비 중 표시 |
| 실제 목록 파서·시간 제한 | 2026-09-10 실제 목록·마지막 페이지·빈 목록·원문 링크 확인. `kicpa_face_v1`과 `live-config.json` 준비 |
| 발송 처리 | 업체 공통 인터페이스와 오프라인 가짜 발송기 검증 |
| 실제 발송 | 기본 발송기에서 차단. 환경변수만 바꿔도 실행 불가 |
| 운영 DB·앱 배포 | 2026-09-10 운영 배포·SQL 3개 적용 및 HTTP·권한 검증 완료. [배포 기록](kicpa-production-20260910.md) 참고 |
| 수집 예약·메시지 | 자동 수집 연결 및 검증은 [수집 운영 기록](kicpa-collection-20260910.md) 참고. 메시지 발송은 계속 비활성 |

수집 주소는 사용자가 제공했다.

- [수습CPA 게시판](https://www.kicpa.or.kr/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu07.page)
- [CPA 구인게시판](https://www.kicpa.or.kr/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu01.page)

2026-09-09 밤의 로컬 검증은 한국시간 22시 이후여서 KICPA 요청 없이 수행했다. 이후 외곽 페이지와 정책 페이지 확인을 거쳐 2026-09-10 허용시간에 실제 목록 구조·원문 링크·페이지 이동·빈 목록을 확인했다. 상세 근거는 [수집 운영 기록](kicpa-collection-20260910.md)에 남겼다. `tests/fixtures/kicpa-jobs`의 공고 값은 합성 자료이며 실제 사이트 내용과 구별한다. 검증된 설정과 명시적인 활성화 조건이 없으면 실제 수집을 거부한다. 합성 설정은 검증 플래그를 켜도 운영 수집에 사용할 수 없다.

현재 확인한 수습CPA 40건과 CPA 130건은 한 번에 100건씩 읽어 목록 3회 요청으로 전체를 확인한다. 여러 페이지인 게시판의 첫 페이지 재확인을 포함하면 4회다. 본문이나 연락처 등의 상세 정보는 추출하지 않는다. 매번 전체 범위를 확인하므로 기존 글 ID를 만났다는 이유로 탐색을 중단하지 않는다. 페이지 순환·한도 초과·구조 변경·전체 건수나 행 ID 불일치는 부분 목록으로 기준을 초기화하지 않고 해당 게시판 저장을 중단한다. 확인되지 않은 공지 형태가 나타나면 일반 글로 추정하지 않고 구조 확인을 요구한다.

## 데이터와 접근 권한

2026-09-10 운영 배포에서는 웹을 먼저 배포한 뒤, 공통 계정 스키마가 준비된 상태에서 다음 채용 마이그레이션 3개를 순서대로 하나의 트랜잭션으로 적용했다. 기존 공통 계정 마이그레이션을 다시 실행하거나 이전 SQL 파일을 재작성하지 않았다. 적용 버전과 운영 검증 결과는 [배포 기록](kicpa-production-20260910.md)을 기준으로 확인한다.

| 순서 | 마이그레이션 | 목적 |
| --- | --- | --- |
| 1 | [`20260909010000_kicpa_jobs.sql`](../supabase/migrations/20260909010000_kicpa_jobs.sql) | 공고·구독·발송 기록의 기본 스키마 |
| 2 | [`20260910020000_kicpa_jobs_summary_fields.sql`](../supabase/migrations/20260910020000_kicpa_jobs_summary_fields.sql) | 요약 필드만 수집·공개하도록 RPC와 공개 컬럼 권한 제한 |
| 3 | [`20260910093000_kicpa_jobs_membership_guard.sql`](../supabase/migrations/20260910093000_kicpa_jobs_membership_guard.sql) | 공통 계정 전환 이후 설치되는 채용 구독에도 CPA 가입 회차 검증 적용 |

| 객체 | 역할 | 접근 |
| --- | --- | --- |
| `cpa_kicpa_jobs` | 제목·회사명·게시일·원문 링크, 공고 식별·법인 연결 | anon/authenticated는 허용된 공개 필드만 읽기, service_role 쓰기 |
| `cpa_kicpa_job_boards` | 게시판별 최초 수집 기준과 확인 시각 | service_role |
| `cpa_kicpa_jobs_subscribers` | 신청 설정, 현재 동의 버전·시각, 추후 수신번호·인증시각 필드 | service_role |
| `cpa_kicpa_job_deliveries` | 공고·구독자별 처리 상태 | service_role |
| `cpa_kicpa_jobs_subscription_status` | 본인의 희망 상태·선택 게시판·동의 갱신 필요 여부 | authenticated 본인만 |

공고 식별자는 `(board, id)`다. 법인명/별칭이 정규화 후 정확히 하나의 법인에 대응할 때만 연결하며, 모호한 공고도 전체 목록에는 남긴다. 공고 URL은 KICPA의 HTTPS 주소만 허용한다.

기존 스키마의 `deadline` 컬럼과 기존 값은 적용 이력과의 호환을 위해 남겨 둔다. 후속 마이그레이션 이후 RPC는 이 컬럼을 쓰지 않으며 공개 읽기 권한과 조회·화면·메시지 대상에서 제외한다. 공개 읽기는 `title`, `company`, `posted_at`, `source_url`, `board`, `id`, `firm_id`, `created_at` 여덟 컬럼만 허용한다. 공고 본문·연락처·이메일·첨부파일 저장 기능은 만들지 않는다.

적용 시 수집은 비활성 상태를 유지한다. 이미 운영 중이면 먼저 수집을 중지하고, `deadline` 조회를 제거한 웹 배포 → 기본 스키마 확인 및 후속 요약 필드·가입 회차 마이그레이션 적용 → 새 수집기 배포 순서로 진행한다. 이 순서는 이전 웹의 컬럼 권한 오류와 이전 RPC의 마감일 값 변경을 피하기 위한 것이다. 실제 파서 검증과 수집 활성화는 별도 후속 단계이며 이번 배포에서는 수집을 켜지 않는다. 메시지 발송도 계속 차단한다.

구독 상태 뷰는 소유자 권한으로 기본 테이블을 읽되 `auth.uid()`로 본인 행만 허용하고 익명 인증 사용자를 제외한다. 전화번호와 발송 기록은 뷰/API에 노출하지 않는다. 예약된 전화번호 필드는 현재 비워 둔다. 추후 서버에서 수신번호 인증을 완료한 경우에만 번호와 인증시각을 함께 저장한다.

공통 계정 검증은 로그인 여부에 더해 `common_profiles.account_status`와 CPA 회원의 `membership_status`가 모두 `active`인지 확인한다. 서버가 요청 시작 시 읽은 `membership_version`은 탈퇴·재가입을 구별하는 가입 회차다. 구독 저장은 이 값을 함께 보내고 DB의 공통 가입 회차 트리거가 현재 계정·회원 상태와 다시 비교한다. 이전 가입 회차에서 시작된 요청을 새 가입의 구독으로 저장하지 않으며, 삭제도 요청 시작 시 회차와 일치하는 구독만 대상으로 한다. 회차는 요청 본문으로 받거나 구독 상태 응답에 노출하지 않는다.

가입 회차 마이그레이션은 기존 구독을 잠근 상태에서 검증하고 트리거 설치와 함께 커밋한다. 기존 회차가 현재 가입과 다르거나 계정이 비활성이면 중단한다. 회차가 없는 기존 행은 현재 회차가 1인 경우에만 보완하며, 재가입 이력이 있어 어느 가입의 행인지 확정할 수 없으면 새 회차로 임의 변경하지 않는다.

`is_active`는 수신 희망 상태다. 실제 발송 가능 여부를 뜻하지 않는다. 큐 등록과 처리에는 다음 조건이 모두 필요하다.

1. 수신 희망이 켜져 있다.
2. 현재 동의 버전과 동의 시각이 저장돼 있다.
3. 수신번호와 인증시각이 저장돼 있다.
4. 공고가 선택한 게시판에 해당하고 수신 시작시점 이후에 감지됐다.

현재 동의 버전은 `2026-09-09-v1`이다. 이번 요약 필드 축소는 선택 게시판과 반복 안내 범위를 바꾸지 않으므로 버전을 유지한다. 문구의 정본은 [`lib/kicpa/subscription.ts`](../lib/kicpa/subscription.ts)다. 버전을 바꾸면 SQL의 큐 조건과 Python 발송 전 검사도 함께 변경해야 한다. 현재 구현은 최신 신청 상태와 동의 기록을 저장한다. 발송 서비스 출시 시 과거 동의·철회 증빙의 보존 범위와 개인정보 처리·위탁 안내를 확정한다.

## 구독 API와 화면

- `/jobs`: 최신 공고 50건의 제목·회사명·게시일과 연결된 법인 링크. 공고 제목을 클릭하면 원문이 열린다.
- `/firms/[firm_id]?tab=jobs`: 법인에 연결된 공고의 같은 요약 필드와 제목의 원문 링크. 재무자료와 연도 선택에 의존하지 않는다.
- `/settings`: 로그인 후 게시판 선택, 수신 희망, 반복 안내 동의, 설정 저장·삭제. 준비 상태를 명시한다.
- `GET /api/jobs/subscription`: 본인의 공개 가능한 상태만 반환.
- `PATCH /api/jobs/subscription`: `{active, boards, consent}`만 허용. 활성화에 필요한 현재 동의가 없으면 명시적 동의를 요구한다.
- `DELETE /api/jobs/subscription`: 신청과 해당 발송 기록 삭제.

응답은 `{saved, active, boards, consentRequired, deliveryStatus: 'preparing'}`다. 휴대전화나 인증시각은 포함하지 않는다. 변경 요청은 같은 출처만 허용하고 실제 로그인·공통 계정 활성 상태·CPA 회원 상태와 가입 회차를 검증한다. 익명 학습 세션은 사용할 수 없다.

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
| `KICPA_SCRAPER_ENABLED` | GitHub Variable | `true`일 때 예약 작업 허용. 실제 활성화 확인은 수집 운영 기록 참고 |
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

2026-09-09 로컬 검증 결과: 위 Node 테스트 39개, Python 테스트 34개, 전체 TypeScript 타입 검사와 변경 파일 ESLint가 통과했다. Python 검사에는 리다이렉트 최종 주소를 기준으로 상대 링크를 해석하는 회귀 사례도 포함한다. 당시 권한·큐 처리·설정 API와 수집 시간 제한은 합성 자료로 확인했으며 실제 KICPA 응답을 사용하지 않았다. 별도 외곽 페이지 HTTP 확인과 실제 목록 파서 검증은 구별한다. 운영 DB·휴대전화 전달은 검증하지 않았으며, 다중 DB 연결의 동시 완료도 별도 부하 테스트로 재현하지 않았다.

2026-09-10 요약 필드 변경 검증: DB·공고 링크·법인 탭 Node 테스트 23개와 Python 테스트 38개가 통과했다. 전체 TypeScript 타입 검사, 변경 파일 ESLint, 제목 링크·회사명·게시일의 React 렌더 검증도 통과했다. 추가 수집 필드 거부, 본문·연락처 등이 합성 응답에 있어도 파서·CLI·알림 데이터에 포함되지 않는 점과 공개 컬럼 권한을 확인했다. 이는 운영 DB 적용·배포 전에 수행한 로컬 검증 기록이며, 진행 중인 배포의 성공을 뜻하지 않는다.

## 후속 연결 순서

1. 실제 목록·원문 링크 확인과 요약 네 필드 파서 설정은 완료했다. 구조 변경 시 같은 절차로 다시 검증한다.
2. 웹 배포와 기본·요약 필드·가입 회차 마이그레이션 적용은 완료했다. 최초 적재·재실행 중복 방지·GitHub 실행을 검증하고 수집 운영 기록에 결과를 남긴다.
3. 사용자가 사업자등록과 업체를 결정하면 비즈니스 채널·휴대전화 인증·개인정보 안내를 연결한다.
4. [알림톡 심사 준비안](kicpa-alimtalk-template.md)을 실제 승인 형식으로 확정하고 신청한다. 승인 가능성을 현재 보장하지 않는다.
5. 승인된 템플릿 어댑터, 업체 요청 인증·멱등성, 접수 후 최종 결과 조회/콜백을 구현하고 테스트 수신자로 확인한 다음 발송을 활성화한다.

하루 묶음 발송이나 법인·지역별 추가 조건은 이번 구현에 포함하지 않는다. 현재 기준은 사용자가 선택한 게시판에 해당하는 신규 공고 한 건당 한 번이다.
