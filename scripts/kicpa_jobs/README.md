# KICPA 수집기와 업체 독립적인 발송 준비

2026-09-10 허용시간 내 실제 KICPA 목록·페이지 이동·빈 목록·원문 링크를 확인하고 `live-config.json`과 `kicpa_face_v1` 어댑터를 준비했다. 운영 예약 실행의 활성화 및 확인 결과는 [`docs/kicpa-collection-20260910.md`](../../docs/kicpa-collection-20260910.md)에 기록한다. 외부 메시지 발송은 계속 비활성이다. `tests/fixtures/kicpa-jobs/`의 자료는 가상 공고를 사용하는 테스트용이며, 실제 구조를 확인한 사실은 운영 검증 기록과 구별한다. 카카오 나에게 보내기 API/OAuth 발송 코드는 사용하지 않는다.

공고 원천정보는 **제목·회사명·게시일·원문 URL**만 추출한다. 내부 식별용 게시판·게시글 ID, 법인명/별칭의 정확한 일치로 찾은 `firm_id`, DB 최초 감지 시각은 유지한다. 마감일·본문·연락처·이메일·첨부파일은 추출·적재·출력하지 않으며, 제목을 클릭하면 KICPA 공고 원문으로 직접 이동하도록 원문 URL을 제공한다.

## 오프라인 실행

Python 3.12 이상을 사용한다.

```powershell
python -m pip install -r scripts/kicpa_jobs/requirements.txt
python -m unittest discover -s tests -p 'test_kicpa*.py'
python scripts/kicpa_scraper.py --config tests/fixtures/kicpa-jobs/synthetic-config.json --dry-run
python scripts/kicpa_scraper.py --config tests/fixtures/kicpa-jobs/synthetic-config.json --fixture tests/fixtures/kicpa-jobs/synthetic-trainee.html --board trainee_cpa
python scripts/kicpa_scraper.py --config tests/fixtures/kicpa-jobs/synthetic-config.json --fixture tests/fixtures/kicpa-jobs/synthetic-cpa.json --board cpa
```

`--fixture`와 `--dry-run`은 항상 로컬 파일만 읽는다. 게시판 접속, DB 접근, 큐 변경, 발송을 하지 않는다. `--fixture` 결과의 `has_next_page`는 추가 페이지가 남았는지 표시하며, 단일 파일 파싱이 전체 게시판 검증을 뜻하지 않는다.

## 실제 게시판 어댑터

`live-config.json`은 두 게시판 모두 한 번에 100건을 요청한다. 현재 확인한 수습CPA 40건과 CPA 130건은 목록 요청 3회로 전체를 읽을 수 있다. 여러 페이지인 CPA 게시판은 마지막에 첫 페이지를 다시 확인하므로 정상 실행의 KICPA 요청은 총 4회다. 각 요청 시작 사이에는 최소 1초를 둔다.

서버의 표 헤더·열 수·숫자 행 번호·조회 페이지·전체 건수·`fn_setPage` 페이지 수를 함께 검증한다. 필터 적용 전 행 ID로 중복·누락을 검사하고 페이지 이동 중 목록이 달라지면 해당 게시판은 적재하지 않는다. 실제 빈 목록은 전체 0건, 페이지 표시 `(1,0,10)`, `해당하는 글이 존재하지 않습니다.` 행이 모두 확인될 때만 인정한다. 검증한 구조와 다른 공지 형태도 임의로 일반 공고로 취급하지 않는다.

제목 링크는 실제 사이트의 `fn_detail`이 사용하는 `detailForm.action`과 `ijIdNum`으로 만든다. 로그인 없이 직접 열리는 것을 확인했다. 세션 ID는 URL에서 제거하며, 운영 수집기는 상세 페이지나 첨부파일에 요청하지 않는다.

현재 규모에서는 매번 전체 목록을 확인하므로 ID 크기나 게시일만으로 탐색을 조기에 종료하지 않는다. 기존 글의 순서가 바뀌거나 제목이 수정되는 경우에도 전체 대상에서 확인한다. 설정된 최대 10페이지를 넘거나 전체 행 수가 맞지 않으면 부분 목록으로 최초 기준을 확정하지 않는다. 이후 게시판 규모가 커지면 요청량과 증분 수집 설계를 다시 검토한다. 원문에서 사라진 공고를 이번 작업에서 자동 삭제하지는 않는다.

## 구조 변경 시 재검증

1. 한국시간 **08:30 이상, 18:30 미만**에만 실제 게시판 응답을 확인한다. 알려진 URL은 `adapters.py`의 `BOARD_URLS`에 있다. 로그인 없이 목록·게시글 링크·게시글 ID·공지 구분·정렬·날짜·페이지 이동·마지막 페이지 표시가 어떻게 제공되는지 먼저 검증한다.
2. 구조 변경 시 라이브 어댑터와 설정을 실제 응답에 맞춰 함께 변경한다. `synthetic-config.json`은 일반 어댑터 설정 형식의 예시일 뿐이며 운영에서 거부한다. 실제 HTML에 추정 선택자를 붙이거나 JavaScript 링크에서 번호를 추측하지 않는다.
3. HTML은 `rows_selector`, `empty_selector`, `pinned_selector`, 필드별 선택자/속성, pagination의 `next_selector`/`end_selector`를 명시한다. JSON은 `rows_path`, `pinned_path`/`pinned_values`, 필드별 경로, `pagination.next_path`를 명시하며 마지막 페이지는 명시적인 `null`이어야 한다. `fields`에는 정확히 `id`, `title`, `company`, `posted_at`, `source_url`만 있어야 한다. 추가 필드 선택자는 파싱 전에 차단한다. 모든 시작 URL과 링크는 KICPA HTTPS만 허용한다.
4. 페이지는 명시적 마지막 표시까지 순회한다. 반복 링크, 누락된 마지막 표시, `max_pages` 초과, 공고 5,000건 초과는 해당 게시판의 적재 전에 실패한다. 부분 페이지로 최초 기준 목록을 초기화하지 않는다. 첫 적재는 SQL RPC에서 과거 공고 기준 목록으로 저장하여 발송을 만들지 않는다. 이후 `(board,id)`로 중복을 제거한다.
5. 현재 구현은 모든 페이지를 순회하므로, **5분 주기 활성화 전 게시판 크기·요청량을 확인하고 검증된 정렬/기준 게시글을 이용한 증분 수집을 검토**한다. 페이지 제한을 단순히 늘려 전체 재수집을 계속하는 운영을 권장하지 않는다. 실제 구조 검증 전 증분 수집의 정확성을 주장하지 않는다.
6. SQL migration과 서비스 키 등 배포 설정을 별도로 준비한 뒤 수집만 활성화한다. 실제 메시지 발송업체 선정·구현·승인은 별도 단계다.

## 수집 활성화 설정

| 변수 | 위치 | 의미 |
| --- | --- | --- |
| `KICPA_SCRAPER_ENABLED` | GitHub repository variable | 정확히 `true`일 때만 workflow job 실행 |
| `KICPA_BOARD_LAYOUT_VERIFIED` | GitHub variable / CLI 환경 | 실제 구조 확인 후 정확히 `true` 설정; 미설정은 HTTP/DB 전에 실패 |
| `KICPA_BOARD_CONFIG` | GitHub variable / CLI 환경 | 저장소 안의 검증된 실제 설정 파일 경로; CLI는 `--config` 가능 |
| `SUPABASE_URL` | GitHub Secret / CLI 환경 | Supabase HTTPS 주소 |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secret / CLI 환경 | 서버 전용 서비스 키 |
| `KICPA_NOTIFICATIONS_ENABLED` | GitHub variable / CLI 환경 | 향후 업체 연결 시 사용할 추가 발송 스위치; 현재 `true`여도 발송 불가 |
| `KICPA_APP_ORIGIN` | GitHub variable / CLI 환경 | 향후 메시지의 서비스 링크 origin; 예: `https://audit-say.vercel.app` |

GitHub Actions는 매일 KST 08:30–18:25에 5분 간격으로 예약된다. 예약 실행은 정확한 시각을 보장하지 않는다. 지연 실행과 수동 실행도 런타임 검사를 통과해야 하며, **모든 게시판 HTTP 요청·재시도·리다이렉트 요청 직전** 시간대를 다시 검사한다. 시간 우회 옵션은 없다. 기본 HTTP 클라이언트의 자동 리다이렉트도 끈다.

상대 게시글 링크와 다음 페이지 링크는 리다이렉트 후 최종 URL을 기준으로 해석한다. 페이지 순환 검사는 요청 URL과 최종 URL을 함께 추적하며, 페이지 수 제한에는 리다이렉트 별칭을 중복 계산하지 않는다.

## 발송 인터페이스

`configured_provider()`는 환경변수와 무관하게 `DisabledProvider`만 반환한다. 비활성 업체는 큐 claim, 수신자 조회, 상태 변경조차 하지 않는다. 실제 업체를 구현한 코드나 메시지 API 주소·키는 없다. `FakeProvider`는 오프라인 테스트 주입 전용이며 CLI로 선택할 수 없다.

`Notification`은 발송 ID, 수신번호, 해당 게시판, 회원이 선택한 게시판과 조건 문구, 제목, 회사, 게시일, KICPA 원문 URL, 서비스 공고 URL, 설정 URL을 전달한다. 원문 버튼은 `source_url`로 직접 연결한다. 수신번호는 객체 repr에도 표시하지 않는다. 회사·게시일이 없는 경우 임의 데이터를 채우지 않으며, 향후 업체 템플릿에서 `원문 확인`으로 표시한다. 템플릿 초안은 `docs/kicpa-alimtalk-template.md`를 참고한다.

`DeliveryResult`는 다음 의미를 가진다.

| 결과 | DB 상태 | 재시도 |
| --- | --- | --- |
| `accepted` | `accepted` | 업체 접수만 확인. provider_message_id 필수. 자동 재전송 없음 |
| `sent` | `sent` | 최종 성공 확인. 모든 수신자 성공 후에만 공고 notified_at 기록 |
| `rejected` | `failed` | 명시적 발송 거절. DB 지연과 최대 5회 제한을 적용한 재시도 가능 |
| `uncertain` 또는 발송 중 예외 | `uncertain` | 성공 여부 불명. 자동 재시도 금지 |

현재 `finish` RPC는 `sending`에서만 결과를 기록한다. `accepted`의 최종 성공·실패를 확정하는 인증된 webhook/callback은 업체 선정 후 추가해야 한다. 제공자가 요청을 접수했다는 이유만으로 `sent`로 기록하면 안 된다. 실제 업체에 제공할 idempotency key는 delivery ID이며, 제공자가 이를 지원하는지는 연동 시 확인한다.

SQL claim과 Python 발송 직전 확인은 활성 상태, 선택 게시판, 동의 버전 `2026-09-09-v1`, 동의 시각, 인증된 전화번호, 재개 이후 공고 시각을 검사한다. 이번 제품 화면은 전화번호를 수집하지 않으므로 현재 신청만으로는 발송 대상이 되지 않는다.
