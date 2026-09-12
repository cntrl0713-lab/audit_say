# Audit Say 🏹

KICPA 회계감사 서술형 문제를 풀고, 기준서 근거와 criterion 단위 판정을 바탕으로 AI 채점 피드백을 받는 v3 학습 플랫폼입니다.

## 현재 기능

- `/`: 이메일 로그인·회원가입과 Supabase 익명 세션 기반 비회원 학습
- `/quiz`: 물음별 주제·학습 유형으로 탐색하고 기준서형 한 물음 또는 사례형 문제의 모든 물음을 제출·채점
- `/curriculum`: 물음별 다중 주제를 반영한 기준서형·사례형 분포와 풀이 링크
- `/profile`: 회원 등급·레벨·경험치 확인
- `/history`: 회원 풀이 이력과 저장된 채점 결과 확인
- `/review-notes`: 감점 물음 자동 등록, 수동 추가·해결 및 메모
- `/ranking`: 누적·주간·월간 경험치 기준 상위 학습자 확인
- `/admin`: 관리자 전용 문제은행 현황 조회 및 회원 권한 변경

채점 결과와 회원 경험치는 한 트랜잭션으로 저장하며 같은 제출 재시도는 중복 적립하지 않습니다. 비회원은 익명 Supabase 세션으로 학습하며 풀이 결과는 7일 보관하고 영구 프로필이나 경험치를 만들지 않습니다.

2026-09-08 기준 [운영 앱](https://audit-say.vercel.app/) 배포와 경험치 원장 초기화를 완료했습니다. 신규 테이블 20개와 최종 문제은행 96세트·192물음·521criterion을 사용하며 `CPA_LEARNING_DB_ENABLED=true`로 풀이 이력·오답노트·기간 랭킹을 활성화했습니다. 운영 경로·초기화 집계와 실제 비회원 빈 답안 제출·같은 제출 재시도·결과 복원·7일 보관 계약을 확인했습니다. AI 실제 호출과 전체 브라우저 E2E는 이번 확인 범위에 포함하지 않았습니다. 적용 이력과 확인 범위는 [학습 DB 구현·전환 기록](docs/CPA-학습-DB-구현-전환-기록.md), 테이블 설계는 [DB 설계서](docs/CPA-문제은행-v3-학습-기록-DB-설계.md)를 참고하세요.

## 문제은행과 채점

물음의 `question_style`은 `case`(사례형) 또는 `standard`(기준서형)이며, 답안 형식 `type`과 별개입니다. 사례형만 사실관계 부모에 연결하고 기준서형은 독립 발문으로 한 물음씩 풉니다. 주제는 물음별 다대다 관계이며, 특정 주제로 찾은 사례도 소속 사례형 물음을 모두 보여줍니다. 저장 계보·봉인 분류·기존 제출 호환·신규 등록의 계약은 [물음별 학습 단위와 DB 계약](docs/물음별-학습-단위와-분류-계약.md)을 확인하세요.

문제은행은 `cpa_uploader/data/cpa_question_sets_v3.authoring.json`을 편집 정본으로, `cpa_uploader/data/cpa_question_sets_v3.public.json`을 공개 문제 목록으로 사용합니다. 공개본에는 모범답안·requirements·criterion·source quote가 포함되지 않습니다.

Supabase의 프로젝트 소유 테이블은 `cpa_*` 접두어를 사용합니다. 회원 프로필은 `cpa_users`, 회계법인 데이터는 `cpa_firm_*`입니다. 기존 이름은 배포 호환용 뷰로 유지하며 다른 앱의 `cta_*`와 Supabase 관리 테이블은 변경하지 않습니다. [테이블 이름 전환 기록](docs/프로젝트-테이블-cpa-접두어-전환.md)을 참고하세요.

현재 운영 조회·채점은 DB의 게시된 문제 버전을 사용하며, 제출은 당시 버전에 연결됩니다. DB 조회 실패 시 파일 은행으로 자동 전환하지 않습니다. DB 모드를 끈 파일 기반 실행은 `data/cpa_question_sets_v3.authoring.enc.json`을 복호화하며, production tracing에서도 평문 authoring 파일을 제외합니다. 파일 은행의 상태 전환은 `cpa_question_sets_v3.promotions.json` 장부로 추적합니다.

기본 채점 모델은 OpenAI `gpt-5.6-luna`이며 `CPA_GRADING_MODEL`로 변경할 수 있습니다. 모델은 criterion 판정과 답안 근거 구간 ID를 반환합니다. 코드는 ID와 판정의 누락·중복을 검사하고 원문 인용을 복원하며, 보안 의심을 별도 확인한 뒤 점수를 합산합니다. 응답·실행 오류는 학생 감점으로 처리하지 않습니다. 자동 출제는 `CPA_GENERATION_MODEL`로 모델을 지정하며 결과는 사람 검수용 draft로만 기록됩니다.

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
npm run analysis:check
node cpa_uploader/wiki/scripts/lint-wiki.mjs
npm run lint
npm run build
```

문제은행 제작·배포 명령과 원자료 규칙은 [`cpa_uploader/README.md`](cpa_uploader/README.md)에 정리되어 있습니다.

## 자료 관리와 출제 현황

[통합 출제 현황](cpa_uploader/wiki/_meta/authoring-dashboard.md)에서 OX 학습 순서에 따라 요구사항·출제 빈도·현재 문항과 검토/게시 상태를 확인합니다. 자료별 정본과 변경 순서는 [관리 규칙](docs/출제-검토-자료-관리.md), 보고서·계획은 [docs 안내](docs/README.md), 분석 입력·생성 결과는 [analysis 안내](cpa_uploader/analysis/README.md)를 따릅니다.

분석 입력을 바꾼 뒤에는 `npm run analysis:build`, `npm run analysis:check`, `npm run wiki:build`, `npm run wiki:check` 순서로 갱신·검사합니다. 생성된 숫자나 표를 직접 수정하지 않습니다. 과거 검토 자료는 [이전·보존 장부](cpa_uploader/analysis/reviews/question-review-2027/migration-manifest.json)와 함께 보존하며 최신 은행 현황과 구분합니다.

## 문제 제작·검토 스킬

프로젝트 공통 작업 지침은 [AGENTS.md](AGENTS.md)에서 관리하며 [CLAUDE.md](CLAUDE.md)는 같은 파일을 가져옵니다. 상세 자료 관리 정책과 개별 스킬의 절차는 링크된 소유 문서에서 수정합니다. 이 연결 방식은 [Codex AGENTS.md 안내](https://learn.chatgpt.com/docs/agent-configuration/agents-md)와 [Claude의 AGENTS.md 가져오기 안내](https://code.claude.com/docs/en/memory#agentsmd)를 따릅니다.

저장소의 공통 지침을 Codex와 Claude Code에서 함께 사용합니다. Codex는 [`.agents/skills/`](.agents/skills/)의 본문을, Claude Code는 [`.claude/skills/`](.claude/skills/)의 진입점을 통해 같은 본문을 읽습니다. 심볼릭 링크나 별도 복사 설치가 필요하지 않습니다.

| 작업 | Codex | Claude Code | 공통 본문 |
| --- | --- | --- | --- |
| 신규 문제·물음 제작 | `$audit-question-author` | `/audit-question-author` | [제작 지침](.agents/skills/audit-question-author/SKILL.md) |
| 기존 문항 검토·수정 | `$audit-question-review` | `/audit-question-review` | [검토 지침](.agents/skills/audit-question-review/SKILL.md) |

프로젝트에서 실행한 Claude Code에 `/audit-question-author 기출·연습 요구사항별 빈도와 미출제 후보를 연결해 지정한 설계안 전체를 제작해줘` 또는 `/audit-question-review 지정한 초안을 원문·배점과 대조하고 결함을 수정해줘`처럼 요청합니다. 일반적인 제작·검토 요청에도 스킬 설명에 따라 적용될 수 있습니다. 새 스킬이 보이지 않으면 프로젝트에서 세션을 다시 시작합니다. 지원하는 탐색 경로는 [Codex 공식 안내](https://learn.chatgpt.com/docs/build-skills)와 [Claude Code 공식 안내](https://code.claude.com/docs/en/skills)를 참고하세요.

수정할 때는 `.agents/skills/`의 본문·참조 자료를 갱신합니다. 스킬 이름·설명을 바꾸면 `.claude/skills/` 진입점과 Codex의 `agents/openai.yaml`도 맞춥니다. 개인 폴더에 같은 이름의 오래된 스킬이 있으면 저장소 본문을 읽도록 연결하거나 해당 개인 스킬을 비활성화해 지침 충돌을 해소합니다. 프로젝트 스킬을 사용하는 것만으로 문제의 실제 채점 검증·정본 편입·게시가 수행되지는 않습니다.
