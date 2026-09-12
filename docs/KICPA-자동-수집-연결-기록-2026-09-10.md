# KICPA 자동 수집 연결 기록

2026-09-10 사용자가 자동 수집 진행을 요청했다. 제목·회사명·게시일·원문 링크만 수집하고 매일 KST 08:30 이상 18:30 미만의 요청 제한을 유지한다. 카카오 발송은 별도 준비 단계로 둔다.

## 실제 구조 확인

허용시간에 공개 게시판 외곽 페이지의 `pageInfo.targetUrl`에서 다음 실제 목록 주소를 확인했다.

- 수습CPA: `https://www.kicpa.or.kr/home/jobOffrSrchNewGnrl/list.face?listCnt=100&ijEmpSep=all&page=1`
- CPA: `https://www.kicpa.or.kr/home/jobOffrSrchGnrl/list.face?ijJobSep=1&listCnt=100&page=1`

`listCnt=100`의 실제 응답과 마지막 페이지를 확인했다. 수습CPA 40건은 1페이지, CPA 130건은 2페이지였다. 저장 응답의 오프라인 파싱에서는 수습CPA 40건과 제목에 `수습` 또는 `신입`이 포함된 CPA 공고 5건을 찾았다. 이 수치는 확인 당시의 목록이며 이후 바뀔 수 있다.

목록에는 표·`searchForm`·`detailForm`·페이지 이동 함수가 함께 제공된다. 행 번호·제목·회사명·게시일·게시글 ID와 전체 건수·페이지 수를 검증한다. `listCnt=100` 요청에서도 HTML의 hidden `listCnt` 값은 서버가 `20`으로 출력하므로 이 관측을 별도로 검증하며, 실제 페이지 크기는 요청값과 전체 건수·페이지 수·행 수의 일치로 확인한다.

원문 주소는 관측된 `detailForm` 동작과 `ijIdNum`에서 구성했다. 양쪽 게시판에서 각각 한 건을 직접 열어 선택한 제목이 나오고 로그인으로 이동하지 않는 것을 확인했다. 상세 응답은 보존하지 않았으며 본문·연락처·이메일·첨부파일을 추출하지 않았다. 원문 URL의 `jsessionid`도 제거했다.

제목 검색으로 실제 빈 목록도 확인했다. 전체 0건, `fn_setPage(1,0,10)`, 해당 표 열 수와 같은 `colspan` 및 `해당하는 글이 존재하지 않습니다.` 문구가 일치했다. 운영 설정에는 검색어를 넣지 않는다.

## 요청량과 일관성

현재 전체 목록은 3회 요청이다. 여러 페이지인 게시판은 첫 페이지를 한 번 더 확인하여 총 4회로 일관성을 검사한다. 모든 요청 시작 사이에 최소 1초를 두며, 대기·재시도·리다이렉트 후에도 요청 직전 KST 시간을 검사한다.

모든 페이지의 전체 건수와 페이지 수, 필터 전 일반 행 ID와 연속 번호를 확인한다. 신규 글이나 순서 변경으로 읽는 도중 결과가 달라지면 해당 게시판 적재를 중단하고 다음 실행에서 다시 확인한다. 최초 전체 결과는 기존 SQL의 기준 목록으로 저장하며 과거 글에 발송 큐를 만들지 않는다. 이후 같은 게시판·ID는 갱신하고 새 ID만 추가한다.

## GitHub 준비

기존 `KICPA recruitment collection` 워크플로는 KST 08:30~18:25에 5분 간격으로 예약돼 있다. GitHub 지연 실행에도 런타임 시간 검사를 적용한다. 겹치는 실행은 기존 concurrency 설정으로 직렬화한다.

브라우저에서 `SUPABASE_URL` 저장소 시크릿과 `KICPA_BOARD_CONFIG=scripts/kicpa_jobs/live-config.json`, `KICPA_APP_ORIGIN=https://audit-say.vercel.app`, `KICPA_NOTIFICATIONS_ENABLED=false` 변수를 등록했다. 사용자가 `SUPABASE_SERVICE_ROLE_KEY`를 기존 `Production – audit_say` 환경의 시크릿으로 등록했으므로 수집 작업의 `environment`를 해당 환경에 연결했다. 기존 환경은 승인자·대기 시간·브랜치 제한이 없으며 환경 보호 규칙은 변경하지 않았다. 비밀키를 채팅이나 로그에 출력하지 않았다.

`KICPA_BOARD_LAYOUT_VERIFIED=true`와 `KICPA_SCRAPER_ENABLED=true`를 저장소 변수로 등록해 예약 수집을 활성화했다. `KICPA_NOTIFICATIONS_ENABLED=false`를 다시 확인했다. 최초 적재와 GitHub 실행 결과는 아래 후속 검증 결과로 구분한다.

## 후속 검증 결과

- 전체 Python 테스트 67개 통과(기존 38, 실제 구조 어댑터 18, 수집 일관성·시간 간격 11).
- 검증된 라이브 설정으로 실제 수집을 두 번 실행했다. 모두 허용시간 안에 실행했으며 요청은 실행당 4회다.
- 최초 실행에서 수습CPA 39건과 CPA 조건 일치 5건, 총 44건을 기준 목록으로 저장했다. 구조 확인 시점 이후 수습CPA 원문 목록이 40건에서 39건으로 바뀌어 실제 적재 시점의 전체 결과를 사용했다.
- 두 번째 실행은 양쪽 게시판 모두 신규 0건, `baseline=false`였다. 두 실행 모두 발송 큐 0건, `delivery_disabled`를 확인했다.
- 15:10:54 KST 운영 조회: 공개 공고 44건, 전체 기준 목록 표식 유지, 기존 `deadline` 값은 모두 NULL. 35건은 법인명 또는 별칭의 정확한 일치로 법인과 연결됐다.
- 운영 `/jobs`에서 HTTP 200과 실제 제목·원문 링크 노출을 확인했다. 원문 링크에 세션 ID가 없고 허용된 게시판 상세 경로와 `ijIdNum`만 쓰는 것을 검증했다.
- GitHub 서버의 최초 실제 실행은 [run #2](https://github.com/cntrl0713-lab/audit_say/actions/runs/34445098057)로 성공했다. `main`의 `46f7d8e894d9847f3b935a8f24e177769aabaf4a`에서 `workflow_dispatch`로 한 번 실행했으며 전체 37초였다. 예약은 활성화했지만 이 검증 실행의 이벤트는 수동 실행이다.
- GitHub 로그: 수습CPA `scanned_rows=38`, `matched_jobs=38`, `fetched_pages=1`; CPA `scanned_rows=131`, `matched_jobs=5`, `fetched_pages=3`. 양쪽 모두 `inserted=0`, `queued=0`, `baseline=false`였고 마지막 이벤트는 `delivery_disabled`였다. 환경 시크릿을 사용하는 실제 DB 적재가 성공했다.
- GitHub 실행 시 원문 목록은 앞선 로컬 확인 이후 변경됐다. 목록에서 사라진 공고를 자동 삭제하지 않는 현재 정책에 따라 저장된 목록과 순간적인 원문 행 수는 다를 수 있다. 지원 가능 여부는 원문을 기준으로 확인한다.
- 15:28:02 KST 읽기 전용 후속 검증: 수습CPA `last_checked_at=15:25:29.001023`, CPA `15:25:36.410950`으로 GitHub 실행 시각에 갱신됐다. 최초 기준 시각은 유지됐고 운영 DB·공개 목록 44건, 발송 기록·대기·성공 모두 0건이었다. `/jobs` HTTP 200과 공개 8개 필드·원문 경로/ID·실제 공고 표시도 통과했다.

로컬 영수증은 저장소에서 제외된 `tmp/kicpa-live-run-*.json`, `tmp/kicpa-collected-verification.json`, `tmp/kicpa-cloud-verification-preactivation.json`, `tmp/kicpa-cloud-verification-postcloud.json`에 보존했다.

## 2026-09-11 예약 보정

9월 10일 예약 실행 두 건은 각각 KST 18:47과 22:21에 뒤늦게 시작해 런타임 시간 제한으로 수집을 건너뛰었다. GitHub가 문서화한 매시 정각의 혼잡·지연·누락 위험을 줄이고 불필요한 실행을 줄이기 위해 예약을 KST 08:37~18:22의 15분 간격으로 변경했다. 분 오프셋은 07·22·37·52를 사용하며, 실제 요청 직전의 08:30 이상 18:30 미만 제한과 수동 실행 경로는 유지한다.

## 2026-09-11 5분 주기 재조정

사용자 운영 방침에 따라 5분 수집 주기를 복원하되 매시 정각은 피했다. 예약은 KST 08:32~18:27에 `02·07·12·17·22·27·32·37·42·47·52·57분` 오프셋으로 실행한다. 실제 요청 직전의 08:30 이상 18:30 미만 제한과 수동 실행 경로는 그대로 유지한다.
