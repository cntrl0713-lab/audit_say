# Audit Say 🏹

KICPA 회계감사 서술형 문제를 풀고, 기준서 근거와 criterion 단위 판정을 바탕으로 AI 채점 피드백을 받는 v3 학습 플랫폼입니다.

## 현재 기능

- `/`: 이메일 로그인·회원가입과 Supabase 익명 세션 기반 비회원 학습
- `/quiz`: 기준서 출처가 연결된 v3 문제 세트 선택, 세부 물음 답안 작성, AI 채점 및 criterion별 결과 확인
- `/curriculum`: 19개 주제와 문제 세트 분포 확인
- `/profile`: 회원 등급·레벨·경험치 확인
- `/history`: 회원 풀이 이력과 저장된 채점 결과 확인
- `/review-notes`: 감점 물음 자동 등록, 수동 추가·해결 및 메모
- `/ranking`: 누적·주간·월간 경험치 기준 상위 학습자 확인
- `/admin`: 관리자 전용 문제은행 현황 조회 및 회원 권한 변경

채점 결과와 회원 경험치는 한 트랜잭션으로 저장하며 같은 제출 재시도는 중복 적립하지 않습니다. 비회원은 익명 Supabase 세션으로 학습하며 풀이 결과는 7일 보관하고 영구 프로필이나 경험치를 만들지 않습니다.

2026-09-08 기준 [운영 앱](https://audit-say.vercel.app/) 배포와 경험치 원장 초기화를 완료했습니다. 신규 테이블 20개와 최종 문제은행 96세트·192물음·521criterion을 사용하며 `CPA_LEARNING_DB_ENABLED=true`로 풀이 이력·오답노트·기간 랭킹을 활성화했습니다. 운영 경로·초기화 집계와 실제 비회원 빈 답안 제출·같은 제출 재시도·결과 복원·7일 보관 계약을 확인했습니다. AI 실제 호출과 전체 브라우저 E2E는 이번 확인 범위에 포함하지 않았습니다. 적용 이력과 확인 범위는 [학습 DB 구현·전환 기록](docs/cpa-learning-db-implementation.md), 테이블 설계는 [DB 설계서](docs/cpa-learning-db-design.md)를 참고하세요.

## 문제은행과 채점

문제은행은 `cpa_uploader/data/cpa_question_sets_v3.authoring.json`을 편집 정본으로, `cpa_uploader/data/cpa_question_sets_v3.public.json`을 공개 문제 목록으로 사용합니다. 공개본에는 모범답안·requirements·criterion·source quote가 포함되지 않습니다.

Supabase의 프로젝트 소유 테이블은 `cpa_*` 접두어를 사용합니다. 회원 프로필은 `cpa_users`, 회계법인 데이터는 `cpa_firm_*`입니다. 기존 이름은 배포 호환용 뷰로 유지하며 다른 앱의 `cta_*`와 Supabase 관리 테이블은 변경하지 않습니다. [테이블 이름 전환 기록](docs/cpa-table-prefix.md)을 참고하세요.

현재 운영 조회·채점은 DB의 게시된 문제 버전을 사용하며, 제출은 당시 버전에 연결됩니다. DB 조회 실패 시 파일 은행으로 자동 전환하지 않습니다. DB 모드를 끈 파일 기반 실행은 `data/cpa_question_sets_v3.authoring.enc.json`을 복호화하며, production tracing에서도 평문 authoring 파일을 제외합니다. 파일 은행의 상태 전환은 `cpa_question_sets_v3.promotions.json` 장부로 추적합니다.

기본 채점 모델은 OpenAI `gpt-5.6-luna`이며 `CPA_GRADING_MODEL`로 변경할 수 있습니다. 모델은 criterion 판정과 답안 원문 인용을 반환하고, 점수 합산·인용 검증·주입/키워드 샐러드 차단은 코드가 수행합니다. 자동 출제는 `CPA_GENERATION_MODEL`로 모델을 지정하며 결과는 사람 검수용 draft로만 기록됩니다.

## 기술 스택

- **프론트엔드**: Next.js 16 App Router, React 19, Tailwind CSS v4
- **백엔드/DB**: Supabase PostgreSQL, SSR cookie auth, 서버 전용 service-role client
- **AI**: OpenAI Responses API와 구조화 JSON 출력
- **배포**: Vercel tracing 설정 및 Supabase RLS

## 로컬 실행

`.env.local`에 최소한 다음 값을 설정합니다.

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
CPA_QUESTION_V3_ENCRYPTION_KEY=...
```

`CPA_QUESTION_V3_ENCRYPTION_KEY`는 production에서 암호화 authoring 파일을 읽을 때 필요합니다. `CPA_GRADING_MODEL`, `CPA_GENERATION_MODEL`, `CPA_V3_OUTPUT_PATH`, `CPA_QUESTION_V3_AUTHORING_PATH`, `CPA_QUESTION_V3_ENCRYPTED_PATH`, `CPA_QUESTION_V3_PUBLIC_PATH`는 선택 설정입니다. `DANGEROUSLY_BYPASS_AUTH_FOR_TESTS`는 production에서 사용하지 않습니다. 출제 draft는 기존 authoring/public/promotions 파일을 덮어쓸 수 없습니다.

```bash
npm install
npm run dev
```

## 검증 명령

```bash
npm run typecheck -- --incremental false
node node_modules/typescript/bin/tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters
npm test
npm run questions:v3:validate
node cpa_uploader/wiki/scripts/lint-wiki.mjs
npm run lint
npm run build
```

문제은행 제작·배포 명령과 원자료 규칙은 [`cpa_uploader/README.md`](cpa_uploader/README.md)에 정리되어 있습니다. v2 채점 엔진의 과거 검증 보고서와 계획서는 [`docs/archive/`](docs/archive/)에 보관합니다.
