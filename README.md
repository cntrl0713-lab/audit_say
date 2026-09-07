# Audit Say 🏹

KICPA 회계감사 서술형 문제를 풀고, 기준서 근거와 criterion 단위 판정을 바탕으로 AI 채점 피드백을 받는 v3 학습 플랫폼입니다.

## 현재 기능

- `/`: 이메일 로그인·회원가입과 Supabase 익명 세션 기반 비회원 학습
- `/quiz`: 기준서 출처가 연결된 v3 문제 세트 선택, 세부 물음 답안 작성, AI 채점 및 criterion별 결과 확인
- `/curriculum`: 19개 주제와 문제 세트 분포 확인
- `/profile`: 회원 등급·레벨·경험치 확인
- `/ranking`: 경험치 기준 상위 학습자 확인
- `/admin`: 관리자 전용 문제은행 현황 조회 및 회원 권한 변경

채점 결과의 양수 점수는 회원의 경험치에 반영됩니다. 비회원은 실제 익명 Supabase 세션으로 학습할 수 있지만 영구 프로필을 만들지 않습니다.

## 문제은행과 채점

문제은행은 `cpa_uploader/data/cpa_question_sets_v3.authoring.json`을 편집 정본으로, `cpa_uploader/data/cpa_question_sets_v3.public.json`을 공개 문제 목록으로 사용합니다. 공개본에는 모범답안·requirements·criterion·source quote가 포함되지 않습니다.

운영 채점은 `data/cpa_question_sets_v3.authoring.enc.json`을 복호화해 사용합니다. production에서는 암호화 파일을 선택하며, `next.config.ts`도 암호화 배포 파일만 tracing에 포함하고 평문 authoring 파일은 제외합니다. 상태 전환은 `cpa_question_sets_v3.promotions.json` 장부로 추적합니다.

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
