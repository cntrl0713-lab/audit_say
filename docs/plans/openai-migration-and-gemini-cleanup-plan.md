# 회계감사 출제·채점 OpenAI 전환 및 Gemini/RAG·스킬 정리 계획

작성일: 2026-09-08  
상태: 핵심 코드·의존성·로컬 지침 정리 적용 완료. 실제 OpenAI API 품질 평가·배포 환경 키 정리·원격 자산 확인은 미완료.

## 1. 목표

회계감사 문제 자동 출제와 답안 자동 채점을 OpenAI API로 이전하고, 해당 기능의 Gemini SDK·모델·키·File Search RAG 의존성을 제거한다. 기존 문제은행, 원문 근거, 점수 계산 정책, 학습 화면과 경험치 반영을 유지한다. 저장소 내부의 중복 스킬·워크플로와 특정 모델 역할 지침도 정리한다.

사용자가 확정한 범위:

- 자동 출제·채점을 중단하지 않고 다른 AI로 유지한다.
- 교체 공급자는 OpenAI다. 구체적인 모델 ID는 아직 정하지 않았다.
- 스킬 정리 대상은 이 저장소의 `.agent/`, `.agents/`, `.claude/` 및 루트 지침이다. 전역 설치 스킬·플러그인은 대상이 아니다.
- 이번 작업은 이 계획의 로컬 코드·의존성·지침 정리 항목을 적용한다. 실제 API 품질 평가와 배포·원격 자산 정리는 실행 환경 확인 후 별도 완료 처리한다.

## 2. 목표 동작과 현재 근거

### 목표 동작

1. `/quiz`에서 제출하면 OpenAI가 criterion 충족 여부와 답안 원문 인용을 반환한다.
2. 점수·부분점수·상한·보안 판정 반영은 기존 코드가 계산하고, 성공한 양수 점수만 경험치에 반영한다.
3. 자동 출제 CLI는 로컬 출처를 입력으로 받아 OpenAI로 v3 draft를 생성한다. 검증과 사람 검수·승급·컴파일을 거쳐 문제은행에 반영한다.
4. Google 키가 없어도 출제·채점이 작동한다. 실패 시 Gemini로 되돌아가는 호출 경로가 없다.
5. Gemini File Search, 원격 RAG 저장소, 임베딩 인덱싱을 출제·채점에 사용하지 않는다. OpenAI File Search로 옮기는 작업도 하지 않는다.
6. 스킬의 실질 내용은 한 정본에서 관리하고, 필요한 도구별 진입점만 남긴다.

### 확인한 실제 의존성

| 위치 | 현재 사실 | 계획상 처리 |
|---|---|---|
| `lib/questionV3Grading.ts:1,218–260` | Google SDK import, `gradeQuestionSetV3(..., apiKey)`, 기본 모델 `gemini-3.1-flash-lite`, 최대 3회 호출 시도 | 호출만 OpenAI로 교체. 순수 판정 적용 함수·결과 타입 보존 |
| `app/actions.ts:49–101` | 인증 → 입력 검증 → quota → `GOOGLE_API_KEY` → 비공개 문제은행 → 채점 → 경험치 | 순서와 반환 계약 유지, 서버 설정과 새 호출부 연결 |
| `app/quiz/QuizClient.tsx:51–69` | Server Action 결과를 성공/실패로 구분하고 성공 시 결과 표시·프로필 갱신 | UI 성공/오류 흐름 회귀 확인. 공급자 선택 UI 추가 불필요 |
| `app/quiz/layout.tsx:1–8` | Gemini를 언급하는 timeout 주석, `maxDuration=60` | 주석 정정. 새 공급자의 총 대기 시간 예산 검증 |
| `cpa_uploader/generate_cpa_v3.ts:525–578` | Gemini 직접 호출, 로컬 출처 묶음, JSON schema, 검증·재시도 | OpenAI 구조화 출력 연결, 출처·검증 유지 |
| 같은 출제 파일의 `main()` | 전체 생성 시 authoring/public 파일을 직접 덮어씀. 체크포인트 복구 존재 | 전환 평가를 별도 draft 출력으로 격리하고 기존 은행 덮어쓰기 방지 |
| `lib/ragRetriever.ts` | 미추적 파일. `retrieveReferenceContext` 호출처 없음. 삭제된 `rag_config.json`을 읽고 Gemini File Search 호출 | 파일 제거 |
| RAG CLI·설정 | `index_references.ts`, `rag_query.ts`, `rag_config.json`, `rag:index`, `rag:query`는 이미 없음 | 재삭제 항목으로 잡지 않고 부재 확인 |
| `cpa_uploader/wiki/raw/source-manifest.md:48` | 실제로 없는 `data/rag_config.json` 행이 남음 | 위키 생성기를 기준으로 산출물 갱신 |
| `package.json:19`, `package-lock.json` | `@google/genai` 의존성 | 모든 소비자 이전 후 npm으로 제거 |
| `.env.local` | `GOOGLE_API_KEY` 변수명 존재 확인. 값은 보고하지 않음 | 로컬 설정에서 제거, OpenAI 키는 서버 환경으로 주입 |
| `.agent/rules/role.md`, `agent-role-split.md` | SHA-256 동일. 특정 두 모델에 역할 고정 | 두 파일 제거 |
| `.agent/workflows/plan.md`, `plan-strict.md` | SHA-256 동일, Gemini 구현자를 가정 | 중복 제거·정본 참조로 통합 |
| `.agents/skills/*`와 `.claude/skills/*` | plan·plan-strict·review 세 쌍의 SHA-256이 각각 동일 | `.agents`를 정본으로 두고 `.claude`는 짧은 진입 문서로 축소 |
| `.agent/workflows/review-feature.md` | `review.md`보다 단순한 옛 버전 | 강화된 review 정본으로 통합 |
| README·이전 계획·진행 보고·`supabase-rls.md` | 활성 설정 안내와 역사 기록이 섞여 있음 | 현행 안내 갱신, 역사 문서에는 폐기 상태를 명시 |

주의: 현재 채점 구현은 **한 문제 세트의 여러 물음을 한 요청으로 판정하고, 실패 시 최대 3회 시도**한다. `layout.tsx`와 일부 문서의 “문항 수만큼 호출” 설명을 현재 동작으로 간주하지 않는다.

### 계획 작성 시 실행한 기준선

| 명령 | 2026-09-08 결과 |
|---|---|
| `npm run typecheck -- --incremental false` | 통과 |
| `npm test` | 84개 통과, 실패 0 |
| `npm run questions:v3:validate` | 96세트·192개 세부 물음·503개 criterion·총 501점, 출처와 public 검증 통과 |
| `node cpa_uploader/wiki/scripts/lint-wiki.mjs` | 오류·경고 0 |
| `npm run lint` | 오류 6개·경고 2개 |

lint 오류 위치는 `app/ranking/page.tsx:26`, `contexts/AuthContext.tsx:110,151`, `lib/ragRetriever.ts:68`, `lib/supabaseAdmin.ts:3`, `lib/supabaseServer.ts:52`다. 경고는 `contexts/AuthContext.tsx:93`, `lib/supabaseAdmin.ts:4`다. RAG 파일 제거로 사라지는 오류 외에는 별도 기존 이슈로 기록한다. 무관한 파일을 정리 범위에 끌어들이지 않는다.

이번 로컬 실행에서는 production build, 실제 OpenAI 호출, 배포 환경 확인, 원격 검색 자산 목록 조회·삭제를 실행하지 않았다. 위키 lint 통과는 원자료 목록의 최신성까지 보장하지 않는다.

### 구현 적용 결과

- `lib/ai/openaiStructured.ts`와 `openai` SDK를 추가하고 Responses API의 strict JSON schema·`store: false`·refusal/incomplete/transport 오류 분류·제한 재시도를 공통화했다.
- 운영 채점은 `OPENAI_API_KEY`와 `CPA_GRADING_MODEL`을 사용하며 기존 코드가 점수·인용 검증·보안 플래그·경험치 반영을 계속 담당한다.
- 출제 CLI는 `CPA_GENERATION_MODEL`과 `--output`을 사용하고, 모델·스키마·원자료 지문이 맞지 않는 체크포인트를 거절하며 authoring/public/promotions 파일을 보호한다.
- 활성 범위 잔여 검색은 0건, `npm ls @google/genai --all`은 `(empty)`, 문제은행·위키 lint·production build는 통과했다. 전체 테스트는 99개 통과했다.
- 실제 API 품질 평가, Preview/Production 키 교체, 로컬 `.env.local`의 이전 키 제거, 원격 검색 자산 식별·폐기는 이 실행에 포함하지 않았다.

## 3. 원자적 요구사항

- OpenAI 호출은 Node 서버/CLI에서만 실행한다.
- 출제와 채점 모델 설정을 분리한다.
- Google 키·SDK·기본 모델명을 새 실행 경로에서 제거한다.
- 공통 전송 모듈은 API 요청·응답 상태·오류 분류만 담당한다.
- 출제 프롬프트와 출제 schema는 출제 영역에서 관리한다.
- 채점 프롬프트와 채점 schema는 채점 영역에서 관리한다.
- 채점 결과의 공개 타입과 Server Action 반환 타입을 유지한다.
- AI는 점수를 결정하지 않는다.
- 판정에 포함된 subquestion/criterion ID의 누락·중복·외부 ID를 점수 계산 전에 검사한다.
- 출처와 일치하지 않는 생성 답안·criterion은 기존 검증기로 거절한다.
- 공급자 출력의 `null`과 기존 도메인 타입의 선택 필드는 경계에서 변환한다.
- API 거절·잘린 출력·비정상 JSON을 정상 0점 결과로 처리하지 않는다.
- 실패한 호출은 경험치를 변경하지 않는다.
- 비공개 모범답안·criterion·source quote를 public JSON에 추가하지 않는다.
- 기존 은행의 ID, 배점, 문구, 승급 장부와 암호화 배포물을 이번 전환 때문에 재작성하지 않는다.
- 폐기된 RAG 모듈·설정 참조·명령 안내를 현행 경로에서 제거한다.
- 스킬 파일의 삭제 근거와 대체 진입 경로를 기록한다.

## 4. 미정 사항과 안전한 가정

### 구현·운영 전환 전에 정할 사항

| 항목 | 제안 및 결정 시점 |
|---|---|
| 모델 ID | OpenAI로 확정. 출제·채점 각각 Structured Outputs 지원, 계정 접근, 품질·지연·비용을 확인한 실제 모델 ID를 Slice 1/평가에서 확정한다. 최신 모델을 무조건 기본값으로 지정하지 않는다 |
| 실행 자격 증명 | Preview/Production에 `OPENAI_API_KEY`를 주입할 수 있어야 실제 검증·전환 가능. 키를 문서/소스/클라이언트에 넣지 않는다 |
| 운영 비용 상한 | 채점 1세트당 허용 비용과 평가 호출 예산을 실제 모델 비교 전에 정한다. 현행 quota는 유지한다 |
| `.agent`·`.claude` 사용 여부 | 사용하지 않는다는 증거가 없으므로 디렉터리 전체를 삭제하지 않는다. 중복 본문과 명백한 구형 지침을 정리하고 진입점은 보존한다 |
| 원격 Google 리소스 | 계정·프로젝트·저장소 ID·공유 사용 여부는 미확인. 원격 목록을 확인하기 전에는 “원격까지 삭제 완료”로 보고하지 않는다 |

위 미정 사항은 이 계획 작성이나 로컬의 미사용 RAG/중복 지침 정리를 막지 않는다. 실제 API 품질 검증과 운영 전환은 모델·접근 권한·평가 예산이 정해진 후 진행한다.

### 기본 가정

- 사용자가 말한 RAG 제거는 Gemini의 원격 검색·인덱싱 계층을 포함한다. 출처 검증과 출제용 로컬 원문 선택은 유지한다. 이것도 넓은 의미의 검색 기반 생성에 해당할 수 있으므로, “모든 출처 조회를 없앤다”로 해석하지 않는다.
- `cpa_uploader/references/`는 공급자 코드가 아닌 읽기용 기준서다. 통합 원자료와 함께 보존한다.
- 역사 문서와 Git 이력은 삭제 증거·과거 동작을 설명하기 위해 공급자 이름이 남을 수 있다. 활성 코드·설정·지침에서 의존성 0을 완료 기준으로 삼는다.
- 전환 후 기본 설정명은 `OPENAI_API_KEY`, `CPA_GRADING_MODEL`, 신규 `CPA_GENERATION_MODEL`이다. 공급자별 분기 설정은 만들지 않는다.
- `CPA_GRADING_MODEL`은 이름이 중립적이므로 유지하되 배포 값은 OpenAI 모델로 바꾼다. 오래된 값으로 시작하면 설정 오류를 명확히 낸다.
- 생성 전용 `CPA_V3_TOPIC`, `CPA_V3_FRESH`, `CPA_V3_DEBUG`는 이름만으로 Gemini 잔여물이라 판단하지 않는다. 새 CLI 계약에 필요한 것만 유지·문서화한다.

## 5. 회계감사·채점 위험과 경계 사례

| 위험 | 방지·검증 방법 |
|---|---|
| 같은 답안의 점수가 모델 교체로 바뀜 | 사람 검수 정답 판정 fixture로 criterion별 비교. 기존 모델 출력을 정답으로 간주하지 않는다 |
| 부정어·책임 주체·예외 조건·수치 반전이 정답 처리됨 | `contradicted`·`not_met` 판정의 중대 오류를 따로 집계. 합리적/절대적 확신, 경영진/감사인, 감사절차/감사의견 구분 포함 |
| 금지된 부분점수·중복 인용 득점 | `applyQuestionSetJudgment`, `verifyCriterionVerdicts`, `scoreCriterionVerdicts` 유지·회귀 검증 |
| 일괄 보안 차단과 개별 물음 보안 차단이 혼동됨 | 전역/개별 injection·keyword salad fixture를 각각 검증 |
| 완성된 JSON이지만 판정 ID가 누락·중복됨 | 요청에 포함된 ID 집합과 정확히 대조. 조용히 0점으로 합산하지 않고 잘못된 AI 응답으로 분류 |
| 출력 길이 제한·거절을 학생 오답으로 처리 | 서비스 실패로 반환, 입력 유지·재시도 가능, 경험치 갱신 없음 |
| 재시도가 여러 계층에 중첩되어 비용·시간 급증 | HTTP 재시도 소유자를 공통 모듈 하나로 지정. schema/내용 재생성까지 포함한 전체 호출 횟수·시간 예산 적용 |
| 생성 테스트가 96세트 은행을 파일럿 결과로 덮어씀 | 생성 결과는 별도 draft에만 기록. 기존 authoring/public/promotions/암호화 파일의 해시 불변 확인 |
| 출처 파일을 RAG 찌꺼기로 삭제 | `source_refs.file`, `requirements.source_quote`, 실제 원문 파일 관계 보존. quote 검증을 끄는 방식 금지 |
| 키가 브라우저 번들에 섞임 | 클라이언트는 기존 타입만 import. SDK 모듈은 서버/CLI 경로에서만 참조, production 번들 검사 |
| 미추적 작업·다른 작업 변경 유실 | 현재 dirty tree 목록 기록, 변경 대상만 명시적으로 편집·스테이징. blanket reset/clean 사용 금지 |

현재 `.agents/`, `.hermes/`, `lib/ragRetriever.ts`, `docs/plans/` 등은 미추적이며 README·인증·법인 수집기 등에도 기존 변경이 있다. 구현 시 미추적 파일은 Git 복원이 불가능할 수 있으므로 삭제 대상의 복구본은 스킬 탐색 경로 밖에 두고 위치를 기록한다. 삭제할 파일을 저장소 내부의 다른 활성 폴더로 옮겨 잔여물을 숨기는 방식은 사용하지 않는다.

## 6. 영향받는 경계

| 경계 | 변경 범위 | 유지할 계약 |
|---|---|---|
| UI | 오류·로딩·결과 경로 확인, 부정확한 호출 주석 정정 | 문제 선택, 답안 입력, 결과·모범답안 표시 |
| Server Action | OpenAI 설정과 채점 호출 연결 | 인증, 입력 제한, quota, 결과 union, 양수 점수 경험치 |
| 채점 도메인 | AI 응답 검증 경계 보강 | 정수 배점·부분점수·best_n·인용 검증 |
| 출제 CLI | OpenAI 호출과 별도 draft 출력 | v3 스키마·출처 검증·사람 검수·승급 |
| 저장·직렬화 | OpenAI 전송 schema → 기존 타입 mapper | public/authoring 분리, 암호화, 장부 |
| 의존성·환경 | OpenAI SDK/키 도입, Google SDK/키 제거 | Supabase·암호화 키 등 다른 서비스 설정 |
| 지침·문서 | 모델 고정 역할 삭제·중복 정본 통합 | Next.js 현행 문서 확인, 도메인 검증 규칙 |

DB 테이블·SQL·기존 사용자 경험치에 대한 마이그레이션은 필요하지 않은 구조로 진행한다. `supabase-rls.md`의 설명 변경을 SQL 재실행 사유로 삼지 않는다.

## 7. 최소 구현 구조와 삭제 목록

### OpenAI 호출 구조

```text
app/actions.ts
  → lib/questionV3Grading.ts (프롬프트·출력 계약·기존 점수 적용)
      → lib/ai/openaiStructured.ts (신규: 요청·응답 상태·시간 제한)
          → OpenAI Responses API

cpa_uploader/generate_cpa_v3.ts
  → 동일 OpenAI 전송 모듈
  → 로컬 출처/도메인 검증
  → 별도 draft → 기존 검수·승급·컴파일 흐름
```

전송 모듈 하나와 필요한 테스트를 추가하는 수준으로 시작한다. 멀티 공급자 registry, 자동 fallback router, 새 RAG abstraction, Agents SDK는 도입하지 않는다. Next 전용 `server-only` marker를 공유 CLI 모듈에 무조건 넣어 CLI 실행을 깨뜨리지 않도록 서버 import 경계를 검증한다.

OpenAI SDK의 Responses API와 `text.format`의 JSON schema 구조화 출력을 사용한다. 모델 거절과 미완료 상태는 성공 데이터와 분리한다. API의 응답 저장 옵션은 `store: false`로 명시하는 안을 사용한다. [공식 Responses API](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create)

엄격한 구조화 출력은 객체의 `additionalProperties: false`, 모든 필드의 required 처리, 선택값의 nullable 표현에 맞춰야 한다. 출제의 기존 schema를 그대로 넘기지 않고 전송 schema를 검토하며, `null`은 mapper에서 기존 선택 필드로 바꾼다. 구조 일치와 회계감사 의미의 정확성은 별도로 검증한다. [공식 Structured Outputs 가이드](https://developers.openai.com/api/docs/guides/structured-outputs)

현재 모델 안내는 확인했으나 이 계획에서 특정 모델 성능·단가를 보증하지 않는다. 구현 시 실제 프로젝트에서 사용할 수 있는 후보를 평가하고 출제·채점의 모델 설정을 각각 고정한다. [공식 모델 안내](https://developers.openai.com/api/docs/guides/latest-model)

### 파일별 처리

| 분류 | 파일/디렉터리 | 처리 |
|---|---|---|
| 교체 | `lib/questionV3Grading.ts` | Google import·생성 호출·응답 읽기 교체. 순수 점수 적용 보존 |
| 수정 | `app/actions.ts` | 키 읽기와 호출부 갱신. 반환 code 변경은 가능한 피함 |
| 수정 | `cpa_uploader/generate_cpa_v3.ts` | 공급자 교체·전송 schema 매핑·draft 출력 분리 |
| 신규 | `lib/ai/openaiStructured.ts` | 얇은 서버/CLI 공통 전송 모듈 |
| 제거 | `lib/ragRetriever.ts` | 미사용 원격 검색 구현 전체 |
| 변경 | `package.json`, `package-lock.json` | OpenAI SDK 추가 후 최종 Google SDK 제거. lockfile 직접 편집 금지 |
| 설정 정리 | `.env.local`, 배포 환경 변수 | Google 키 제거, OpenAI 키·모델 주입. 비밀 값은 출력하지 않음 |
| 문서 수정 | `README.md`, `cpa_uploader/README.md`, `supabase-rls.md`, `docs/PROGRESS_AND_PLAN.md` | 현행 공급자·설정·출제 명령·호출 횟수·완료 상태 정정 |
| 산출물 갱신 | `cpa_uploader/wiki/raw/source-manifest.md` 및 생성기가 바꾸는 위키 파일 | 삭제된 RAG 설정 행 제거. generated 파일은 생성기 결과와 대조 |
| 역사 표시 | `docs/plans/code-file-cleanup-plan.md`, `code-file-cleanup-execution.md`, `docs/archive/v2-*` | 과거 보류/유지 판단에 후속 계획 링크. 과거 검증 사실 자체는 변조하지 않음 |
| 범위 구분 | `docs/PLAN_PRD_v2.md` | 법인 챗봇의 미래 공급자를 이번 채점 이전으로 확정하지 않음. 낡은 “단일 엔진” 가정에는 미정/현행 구분 표시 |
| 보존 | `cpa_uploader/data/회계감사_통합학습자료/`, `cpa_uploader/references/` | 원문 근거·참고자료 |
| 보존 | authoring/public/promotions JSON, `data/*.enc.json` | 기존 은행 내용·배포물 |
| 보존 | `validate_cpa_v3.ts`, `validate_draft_v3.ts`, `promote_cpa_v3.ts`, 컴파일 스크립트 | 공급자와 무관한 검증·승급 파이프라인 |
| 범위 밖 | `.hermes/drafts/`, `awesome-design-md/`, 법인 수집기 | 스킬/공급자 삭제와 무관한 사용자 자료·다른 작업 |

`apply_cpa_v3_review.ts`는 기존 은행을 수정하는 도구다. Google 호출이 없으므로 Gemini 제거 이유만으로 삭제하거나 전환 검증 중 실행하지 않는다.

### 스킬·지침 정리안

스킬 파일 6개와 `.agent` 지침 11개를 확인했다. 파일명이나 해시 일치만으로 도구 진입점을 삭제하지 않고, 중복 본문과 역할 고정 규칙을 줄인다.

| 대상 | 결정 | 이유/대체 경로 |
|---|---|---|
| `.agents/skills/plan/SKILL.md` | 유지 | 작은 작업용 계획. strict와 적용 범위가 다름 |
| `.agents/skills/plan-strict/SKILL.md` | 유지 | 출제·채점 변경의 작은 단계·검증 기준 |
| `.agents/skills/review/SKILL.md` | 유지 | 실제 코드 확인·데이터 흐름·회귀 리뷰 |
| `.claude/skills/{plan,plan-strict,review}/SKILL.md` | 본문 축소 | 이름/description과 해당 `.agents` 정본을 읽으라는 지침만 유지. 자동 로딩 가정 없이 도구에서 확인 |
| `.agent/rules/role.md`, `agent-role-split.md` | 삭제 | 동일 내용이며 Gemini/Fable 역할을 고정 |
| `.agent/rules/domain-tax-accounting.md` | 핵심 이전 후 삭제 | 채점 의미·근거·부분점수 규칙을 `AGENTS.md`에 한 번만 기록. 불필요한 세무 예시 확장 금지 |
| `.agent/rules/output-format.md` | 삭제 | 스킬별 출력 지침과 중복·상충 |
| `.agent/workflows/plan.md` | 삭제 | `plan-strict.md`와 완전히 동일. 기존 strict 동작의 대체 경로를 명시 |
| `.agent/workflows/plan-strict.md` | 본문 축소 | `.agents/skills/plan-strict/SKILL.md` 참조 |
| `.agent/workflows/plan-feature.md` | 본문 축소 | `.agents/skills/plan/SKILL.md` 참조, 가벼운 계획 진입점 보존 |
| `.agent/workflows/review.md` | 본문 축소 | `.agents/skills/review/SKILL.md` 참조 |
| `.agent/workflows/review-feature.md` | 삭제 | 강화된 review 정본으로 통합 |
| `.agent/workflows/implement.md` | 모델 중립적인 짧은 지침으로 축소 | 고유한 호출처 전파·작은 범위·실행 검증 규칙을 `AGENTS.md`에 통합하고 참조 |
| `.agent/workflows/implement-feature.md` | 삭제 | implement와 중복 |
| `AGENTS.md` | 보강 | 기존 Next.js 규칙 블록 보존 + 도메인/구현 공통 규칙 |
| `CLAUDE.md` | 유지 | 현재 `@AGENTS.md` 한 줄의 공통 지침 진입점 |
| `.claude/scheduled_tasks.lock` | 유지 | 스킬 본문이 아닌 실행 상태 파일 |

기본안은 **지침 파일 7개 삭제, 중복 본문 6개를 참조 문서로 축소, implement 본문 축소**다. 도구 진입점 제거가 필요하면 실제 사용 여부를 확인한 후 추가한다. 참조 문서가 정본을 제대로 읽지 못하면 해당 진입점은 기능 검증까지 유지하고, 그 제한을 완료 보고에 남긴다. Windows symlink/junction에 의존하는 통합은 첫 단계에 사용하지 않는다.

삭제로 바뀌는 호출 이름은 `plan → plan-strict`, `review-feature → review`, `implement-feature → implement`로 기록한다. 가벼운 계획은 `plan-feature` 또는 `.agents`의 `plan`을 사용한다.

## 8. 구현 슬라이스

의존 순서: **1 → 2 → 3 → 4 → 5**. 각 단계는 별도 diff와 검증 결과를 남긴다. Slice 1–2의 SDK 공존은 개발 중 일시 상태이며 최종 운영 코드에 Gemini fallback을 남기지 않는다.

### Slice 1 — OpenAI 전송 계약 추가

- **목표:** 기존 출제·채점 동작을 바꾸기 전에 OpenAI 구조화 응답을 검증 가능한 모듈로 만든다.
- **예상 파일:** 신규 `lib/ai/openaiStructured.ts`, 신규 `tests/openaiStructured.test.ts`, `package.json`, `package-lock.json`.
- **분리 이유:** SDK·응답 상태 문제와 도메인 채점 변화를 구분한다.
- **연동 변경:** `OPENAI_API_KEY`와 작업별 모델 입력, schema 전달, timeout, 오류 타입, transport 주입 계약을 정한다. 모듈 import 시 키를 요구하지 않고 실제 요청 시 확인한다.
- **구현 결정:** 응답 refusal/incomplete/빈 출력/파싱 실패를 구분한다. 요청당 최대 횟수와 전체 시간 예산을 명시하고 SDK 기본 재시도와 중첩시키지 않는다. 각 모델의 지원 파라미터를 확인해 기존 `temperature`를 무조건 복사하지 않는다.
- **검증:** typecheck, transport mock 기반 성공·거절·출력 잘림·401·429·5xx·timeout 검사. 기본 테스트에서는 실제 API 호출이 발생하지 않아야 한다.
- **완료 조건:** 도메인과 UI 변경 없이 OpenAI 요청/응답 경계가 검증된다. 선택 모델·파라미터·예산은 별도 설정/평가 기록에 남긴다.

### Slice 2 — 자동 출제 이전과 draft 격리

- **목표:** OpenAI로 검증 가능한 신규 문제 draft를 생성한다.
- **예상 파일:** `cpa_uploader/generate_cpa_v3.ts`, 필요 시 신규 `cpa_uploader/questionGenerationSchema.ts`, 신규 `tests/questionV3Generation.test.ts`, `cpa_uploader/README.md`.
- **분리 이유:** 운영 채점과 경험치에 영향을 주지 않고 출처 충실도·schema 적합성을 검증할 수 있다.
- **연동 변경:** Google 호출 제거, `CPA_GENERATION_MODEL` 사용, nullable mapper, 로컬 출처 bundle·trusted metadata·도메인 검증 유지. CLI의 import와 실행을 구분해 테스트 import만으로 main이 실행되지 않게 한다.
- **출력 계약:** `--output`으로 별도 draft 경로를 명시하고 기존 authoring/public/promotions/암호화 경로를 출력 대상으로 거절한다. 파일 충돌도 기본 거절한다. 체크포인트는 draft 작업 범위에 두고 다른 모델/스키마/원문 해시의 작업을 조용히 이어받지 않는다.
- **검증:** 고정 공급자 응답으로 schema 변환·출처 조작 거절·검증 실패 시 출력 없음·기존 은행 해시 불변 확인. 실제 API 평가는 19개 주제에서 최소 1세트씩, 별도 출력만 사용한다.
- **완료 조건:** 평가 draft가 출처·배점·발문 구조 검증을 통과한다. 사람 의미 검수 이전에는 needs_review 상태를 유지한다. 기존 96세트는 그대로다.

### Slice 3 — 운영 채점 이전

- **목표:** 기존 학습 화면에서 OpenAI 판정과 기존 코드 점수 계산을 사용한다.
- **예상 파일:** `lib/questionV3Grading.ts`, `app/actions.ts`, `app/quiz/layout.tsx`, `tests/questionV3Grading.test.ts`, 필요한 채점 요청 경계 테스트. 실제 계약 수정이 필요한 경우에만 `QuizClient.tsx`, `tests/v3Cutover.test.ts` 수정.
- **분리 이유:** 사용자 점수와 경험치를 바꾸는 경로를 출제 변경과 따로 검증한다.
- **연동 변경:** `gradeQuestionSetV3`의 키 인자를 없애거나 설정/판정 함수 주입으로 바꾸면 action과 모든 호출처를 같은 diff에서 수정한다. `QuestionSetGradeResultV3`와 action의 성공/실패 계약을 보존한다.
- **순서 보존:** 인증·payload 제한·quota·서버 문제은행·허용 답안 ID 검증 뒤 모델 호출. 모든 빈 답안은 모델 호출 없이 기존 0점 판정 적용. 정상 완료 뒤에만 경험치 반영.
- **출력 경계:** 요청된 모든 subquestion/criterion을 정확히 한 번 포함하는지 검증한 뒤 기존 `applyQuestionSetJudgment`를 호출한다. 불완전 판정을 정상 학습 점수로 저장하지 않는다.
- **시간 예산:** 현재 60초 설정 안에 요청·재시도·복호화·DB 갱신이 끝나도록 수치를 정한다. 현재 `page.tsx`는 서버 컴포넌트이므로 “client page라 layout에 둔다” 주석도 사실과 다르다. 설치된 Next 문서에 따라 Server Action 시간 설정 위치를 확인하고, 위치 변경 시 production build/Preview에서 검증한다.
- **검증:** 기존 v3·배포·quota 테스트, 0점/부분점수/정답/부정/인용 복제/주입/키워드 나열/빈 답안 fixture, 잘못된 모델 응답, 설정 누락, quota 초과, 공급자 실패 시 경험치 호출 0회. Preview의 회원/익명 사용자 경로와 결과·오류 UI 확인.
- **완료 조건:** Google 키 없이 정상 채점된다. 유효한 성공 결과당 기존 경험치 반영 경로가 한 번 실행되고, 실패는 오류로 표시된다. 중복 제출 자체의 기존 멱등성 문제는 이번 이전에서 별도 확장하지 않는다.

### Slice 4 — Gemini/RAG 의존성 최종 제거

- **목표:** 출제·채점의 Google 의존성을 실제 파일·패키지·설정에서 없앤다.
- **예상 파일:** `lib/ragRetriever.ts` 삭제, `package.json`, `package-lock.json`, `.env.local`, `README.md`, `cpa_uploader/README.md`, 위키 생성 산출물. 배포 설정·원격 정리는 별도 실행 기록.
- **분리 이유:** SDK 소비자가 모두 사라진 후 제거해야 빌드·운영을 끊지 않는다.
- **연동 변경:** `npm uninstall @google/genai`로 의존성 정리. 다른 용도의 Google 패키지까지 이름만으로 삭제하지 않는다. `GOOGLE_API_KEY`를 로컬/Preview/Production에서 정리하고 `CPA_GRADING_MODEL`의 오래된 값도 교체한다.
- **위키:** 생성 전 diff/해시 기록 → `build-wiki.mjs` 실행 → 삭제된 설정 행이 사라졌는지 확인 → lint. 생성기가 원자료와 은행을 바꾸지 않는지 확인하고, 날짜·해시 등 부수 생성 diff를 검토한다.
- **원격 후속:** 기존 Google 프로젝트의 File Search Store/문서/파일을 read-only로 목록화하고 이 프로젝트 전용인지 식별한다. 식별된 전용 리소스와 예약 인덱싱 작업만 폐기 대상으로 제시한다. 공유 키·리소스는 무조건 삭제하지 않는다. 앱 환경의 키 제거와 Google 계정에서 키 폐기는 별개로 기록한다.
- **검증:** npm 의존성 트리, 활성 영역 잔여 검색, 모든 기존 테스트·은행 검증, Google 키가 없는 Preview에서 실제 생성·채점, 번들에 평문 정답/키 노출 없음 확인.
- **완료 조건:** 활성 Google SDK·호출·키 의존성·RAG 모듈·죽은 manifest 행이 없다. 원격 상태는 확인된 결과 또는 미확인을 구분해 보고한다.

### Slice 5 — 스킬·운영 문서 정본 통합

- **목표:** 모델 역할 고정과 중복 스킬 본문을 제거하고 현행 문서가 새 구조를 설명하게 한다.
- **예상 파일:** 7절의 지침 목록, `AGENTS.md`, README, `supabase-rls.md`, 진행 보고, 이전 계획·아카이브의 상태 표시.
- **분리 이유:** 실행 코드 변화와 에이전트 작업 지침 변화를 따로 검토한다.
- **연동 변경:** 공통 규칙을 먼저 정본에 옮긴 뒤 중복 파일을 삭제한다. 정본 참조는 순환되지 않아야 한다. 과거 “RAG 보존”, “SDK 유지” 판단이 현행 명령으로 오인되지 않도록 후속 계획 링크와 날짜를 적는다.
- **검증:** 모든 남은 참조 대상 존재 확인, `AGENTS.md`의 Next 규칙 보존 확인, plan/plan-strict/review의 구별된 사용 조건 확인. 설치·사용 중인 도구에서 진입 문서가 정본을 읽는지 확인한다. 전역 스킬 경로가 diff에 포함되지 않아야 한다.
- **완료 조건:** 특정 모델을 강제하는 역할 규칙이 없고, 같은 절차의 독립 복제본이 없다. 삭제·축소 목록과 유지 이유가 실행 보고에 일치한다.

## 9. 검증·전환·최종 수용 기준

### 모델 품질 평가 기준안

아래 숫자는 현행 품질 측정값이 아닌 **이전 작업의 제안 합격선**이다. 평가 전에 확정하고 결과를 본 뒤 편의상 낮추지 않는다.

| 평가 | 표본·합격 기준안 |
|---|---|
| 출제 | 19개 주제 최소 1세트씩. 최종 채택 draft의 schema·원문 근거·배점 검증 100% 통과. 생성 시도 수/실패율도 숨기지 않고 기록 |
| 채점 품질 | 19개 주제 각 정답/부분·누락/모순 답안 최소 3개씩 = 57개 세트 답안 + 보안·빈 답안·형식 오류 사례. 사람 검수 criterion 정답과 일치율 95% 이상 |
| 중대 오류 | 주체/부정/수치/조건 반전 오답의 정답 처리, 조작된 인용 득점, 주입 성공으로 인한 부당 득점 0건 |
| 반복 안정성 | 대표 경계 답안 10개를 각 3회 실행해 판정 변동 기록. 중대 오류 0건, 합격선 일관 충족 |
| 응답 시간 | 채점 전체 p95 45초 이하를 초기 목표로 측정. 60초 배포 제한 내 여유를 확보. 초과 시 모델·출력 예산·재시도부터 조정 |
| 비용 | 토큰 사용량과 재시도 포함 실측 비용을 보고. 사용자와 확정한 세트당/평가 전체 예산 이하 |

오프라인 mock 통과는 실제 모델 품질 통과와 다르다. 실제 API 접근이나 사람 검수가 미완료면 해당 항목은 미검증으로 남기고 운영 전환을 완료했다고 하지 않는다.

### 검증 명령과 실행 주의

```text
npm run typecheck -- --incremental false
npm test
npm run questions:v3:validate
node cpa_uploader/wiki/scripts/lint-wiki.mjs
npm run lint
npm run build
npm ls @google/genai --all
```

- 변경 파일에는 ESLint를 별도로 적용한다. 전체 lint는 알려진 기준선과 비교하고, 새 오류 0을 요구한다. 기존 5개 오류·2개 경고가 남는다면 전체 lint 통과라고 쓰지 않는다.
- `npm ls @google/genai --all`의 미설치 결과는 `(empty)`와 종료 코드 의미를 함께 판단한다.
- `questions:v3:compile`, 기존 전체 출제 CLI, `apply_cpa_v3_review.ts`, 승급 명령은 검증 명목으로 기존 데이터를 쓰지 않는다. 배포물 round-trip은 임시 fixture로 검증한다.
- SDK 교체 후 `npm ci`/build 검증은 현재 실행 중인 개발 환경과 분리된 검증 checkout에서 수행할 수 있다. 실제 적용할 dirty 변경이 빠진 옛 HEAD를 검사하지 않는다.
- 생성 draft·모델 평가 결과는 별도 위치에 저장하고 기존 은행 4종의 해시 불변을 확인한다.

활성 영역 잔여 검색 예시:

```text
rg -n -i --hidden "gemini|GoogleGenAI|@google/genai|GOOGLE_API_KEY|ragRetriever|retrieveReferenceContext|rag_config|rag:index|rag:query|file_search|fileSearchStore" app lib cpa_uploader scripts tests .agent .agents .claude AGENTS.md CLAUDE.md README.md package.json package-lock.json
```

이 검색은 비밀 환경 파일 값을 출력하지 않는다. 환경은 변수명만 별도 검사한다. 회귀 테스트의 금지 토큰·역사 설명처럼 필요한 언급은 경로와 이유를 적은 유한 예외 목록으로 검토한다. `docs/` 전체나 모든 Google 문자열을 무조건 허용/삭제하지 않는다. 이 계획 자체의 삭제 대상 이름도 의존성으로 계산하지 않는다.

### 운영 전환 순서

1. 변경 파일과 기존 문제은행 해시를 기록한다. 로컬·Preview에 OpenAI 설정을 넣는다.
2. mock/도메인 검증 → 실제 출제 draft → 실제 채점 품질 평가 → Preview UI/권한/경험치 검증을 완료한다.
3. Production 모델·키 설정을 준비하고 Gemini 의존성이 없는 후보를 배포한다. 사용자 점수를 발생시키는 평가는 테스트 계정을 사용한다.
4. 오류율·지연·단가를 확인하고 이전 Google 환경 변수·전용 원격 자산을 정리한다. 공유 자산 여부는 앞 단계에서 확인한다.
5. 최종 보고를 “로컬 코드 정리 / OpenAI 운영 전환 / 원격 Google 자산 정리” 세 상태로 나눠 실제 증거대로 표시한다.

실패 시 배포 전이면 후보 전환을 멈춘다. 배포 후에는 이전에 검증한 OpenAI 설정/릴리스로 복구한다. 최초 전환에서 그런 릴리스가 없으면 채점 실패를 명확히 안내하고 문제 조회를 유지하며 수정한다. 최종 코드에 숨은 Gemini fallback을 두지 않는다. 롤백을 위해 사용자 문제은행·경험치를 일괄 되돌리지 않는다.

### 수용 체크리스트

- [ ] 자동 출제와 자동 채점이 모두 OpenAI로 실제 동작한다.
- [ ] 출제·채점 각각 실제 사용 모델 ID와 평가 결과가 기록되어 있다.
- [ ] Google 키가 없는 환경에서 두 기능이 동작한다.
- [x] 활성 Google SDK/import/API 경로가 없고 lockfile에도 `@google/genai`가 없다.
- [x] 미사용 retriever와 죽은 RAG manifest 항목이 없다.
- [x] 원격 검색/임베딩/File Search를 OpenAI로 재구축하지 않았다.
- [x] 출처 자료·모범답안·배점·ID·승급 장부·기존 배포물은 유지된다.
- [x] public JSON과 브라우저에 비공개 정답·키가 노출되지 않는다.
- [x] 부분점수·best_n·인용 검증·보안 차단 회귀 사례가 통과한다.
- [x] API 실패·거절·잘린 출력이 정상 점수/경험치로 처리되지 않는 코드 경로를 갖는다.
- [x] 자동 생성 CLI가 기존 문제은행 파일을 덮어쓰지 않도록 보호된다.
- [x] 삭제할 지침 7개와 축소할 문서의 정본·대체 경로가 확인되어 있다.
- [x] 남은 스킬 참조가 유효하고 Next.js 지침이 보존되어 있다.
- [x] 전역 스킬·플러그인·무관한 사용자 작업을 변경하지 않았다.
- [x] 현행 운영 문서와 역사 기록이 구분되어 있다.
- [ ] 원격 Google 자산의 정리 완료/공유 유지/미확인을 정확히 기록했다.
- [x] 타입 검사·테스트·은행 검증·위키 lint·production build 결과와 기존 lint 제한을 보고했다.

## 10. 후속 작업으로 이연

- 특정 모델의 장기 비용 최적화·자동 라우팅·다중 공급자 장애 대응.
- 채점 정책 변경, 새 학습 UX, 답안 저장/오답노트, 중복 제출 경험치 멱등성 설계.
- 기존 문제은행 전체 재생성·재채점·새 기준서 반영.
- 법인 챗봇의 공급자 결정과 RAG 구축.
- `references/`, `.hermes/drafts/`, 디자인 자료의 별도 자산 정리.
- 전역 Codex/Claude 스킬·플러그인 제거와 Git 과거 이력 재작성.
- 이번 작업과 무관한 기존 lint 오류 수정.

원격 Google 자산 정리는 권한·리소스 식별이 필요한 실행 단계다. 확인할 수 없다면 로컬 이전 성과와 별도로 미완료 상태를 남긴다.
