# 코드·파일 정리 실행 기록

실행일: 2026-09-08  
기준 계획: [`code-file-cleanup-plan.md`](code-file-cleanup-plan.md)  
기준 커밋: `a6e27f85b87c6f41f1473203c9d906d0733c7fc8`

## 범위와 보존

이번 실행은 이전 계획의 필수 Slice 1~4를 대상으로 한 기록이다. 회계감사 출제·채점의
OpenAI 전환과 원격 검색 계층 정리는 후속 계획인
[`openai-migration-and-gemini-cleanup-plan.md`](openai-migration-and-gemini-cleanup-plan.md)에서 다룬다.

시작 시점부터 다음 미추적 경로는 기존 작업으로 간주해 그대로 보존했다.

- `.agents/`
- `.hermes/`
- `awesome-design-md/`
- 당시의 검색 실험 파일
- 기존 `docs/` 작업 자료

## 기준선

| 항목 | 결과 |
| --- | --- |
| 추적 파일 수 | 170 |
| 추적 `.ts`·`.tsx`·`.mjs` 수 | 43 |
| 기본 타입 검사 | 통과 |
| 미사용 선언 검사 | `app/ranking/page.tsx`의 `React` import로 TS6133 1건 실패 |
| 기존 테스트 | 26개 통과 |
| v3 문제은행 검증 | 96세트·192개 세부 물음·503개 criterion·총 501점 통과 |
| 위키 lint | 오류 0개·경고 0개 |
| 전체 lint | 기존 오류 12개·경고 2개. 신규 진단 없음 |
| production build | 통과 |

정리 전 데이터 SHA-256:

```text
787BEDBD51F72BCE1F83C77DC90482A65B69294D08687528948693045E95A66E  cpa_uploader/data/cpa_question_sets_v3.authoring.json
7978F3CF630811A10FD2183E12AD979A1A4EA6D48F788A72D03674147DB5778A  cpa_uploader/data/cpa_question_sets_v3.public.json
EDB2173D12EF9DA1CFE9BBF05A142F32FA363EAE887FAAE38FD611CCAD0DFBBC  cpa_uploader/data/cpa_question_sets_v3.promotions.json
6D9E63729B261F3BDCE5F4BBADB97D3EF4C72D838602A87661C78572E2CC40C5  data/cpa_question_sets_v3.authoring.enc.json
```

## 후보별 처분

| 대상 | 처분 | 근거 |
| --- | --- | --- |
| `app/ranking/page.tsx`의 `React` 기본 import | 삭제 | 미사용 검사 유일한 TS6133이며 Hook import는 유지 |
| `lib/supabaseServer.ts`의 `assertSelf`, `AuthenticatedSession` | 삭제 | 선언 외 코드 사용처 없음 |
| `proxy.ts`, `supabase-rls.md`의 `assertSelf` 설명 | 현행화 | 실제 인증 검사는 `assertAuthenticated`·`assertAdmin`으로 유지 |
| `app/globals.css`의 `accent` 토큰 | 삭제 | 앱·컴포넌트·템플릿 참조 없음. primary와 중복된 예약 토큰 |
| `app/globals.css`의 `fade-in`, `card-hover` | 삭제 | 클래스·변수·keyframe 참조 없음 |
| `README.md`, `cpa_uploader/README.md` | 현행화 | v3 라우트·환경 변수·정본/공개본/암호화 배포 구조 반영 |
| `tests/walkthrough.md` | `docs/archive/v2-grading-walkthrough.md`로 이력 보관 | v2 런타임 검증 보고서이며 현재 테스트가 아님 |
| `tests/rubric_judgment_engine_plan.md` | `docs/archive/v2-rubric-judgment-engine-plan.md`로 이력 보관 | v2 테이블·루브릭 전제의 과거 계획 |
| `grading-policy-rulings.md` | 유지 및 v2 이력 표기 | 과거 정책·실측 원기록 보존, 현행 v3와 승계 관계 분리 |
| `.hermes/`, `awesome-design-md/`, 에이전트 설정 | 보류·유지 | 이 기록의 범위 밖이며 후속 계획에서 별도 판단 |
| 문제은행 정본·공개본·암호화본·승급 장부 | 유지 | 서로 다른 운영 역할이며 이번 정리 범위 밖 |

## 검증 메모

- Next.js 16.2.10의 `proxy.ts`, `app/**/page.tsx`, `app/**/layout.tsx`, favicon 규약은 유지했다.
- 로컬 smoke 확인에서 홈·커리큘럼·퀴즈·랭킹은 렌더링됐고, 비로그인 프로필/관리자 화면의 보호 동작도 유지됐다.
- `docs/archive/`로 이동한 문서의 삭제된 v2 코드 링크는 현재 파일을 가리키지 않는 이력 표기로 바꿨다.
- Slice 5의 미추적 자료 보관·ignore 정책은 근거가 확정되지 않아 실행하지 않았다.
