# CPA 회계감사 문제은행 (v3) 파이프라인

KICPA 회계감사 2차 시험형 문제를 **v3 linked question set** 스키마로 관리합니다. 편집 정본과
공개 배포본은 JSON으로 유지하고, 운영 채점용 정본은 암호화한 JSON으로 배포합니다.

## 디렉터리 구조

```
cpa_uploader/
├─ data/
│  ├─ cpa_question_sets_v3.authoring.json   # 편집 정본(모범답안·criterion·출처 포함, 현재 Git 추적)
│  ├─ cpa_question_sets_v3.public.json      # 공개 문제본(비공개 채점 데이터 제거)
│  ├─ cpa_question_sets_v3.promotions.json  # 상태 전환 장부(needs_review→verified→published)
│  └─ 회계감사_통합학습자료/                 # source_quote 근거 원자료 — 지우면 은행 검증이 전부 깨진다
├─ references/                              # 감사기준서 원문 마크다운(KGA 코드별) — 읽기용 참고자료
├─ wiki/                                    # 출처 탐색용 위키 (build-wiki.mjs로 재생성)
│  ├─ concepts/                             # 19개 주제: v3 연결 현황 + 원자료 탐색 링크
│  ├─ question-generation/                  # 수동 관리 문서(워크플로·스키마·프롬프트)
│  └─ scripts/                              # build-wiki.mjs / lint-wiki.mjs
└─ generate_cpa_v3.ts 등                    # OpenAI 생성·검증·승급 스크립트
```

저장소 루트 `data/cpa_question_sets_v3.authoring.enc.json`은 운영 채점에 사용하는 암호화 배포물입니다.
`next.config.ts`는 production tracing에 이 파일을 포함하고 평문 authoring 파일을 제외합니다.
현재 기준 은행은 96세트·192개 세부 물음·503개 criterion이며, 정확한 수는 검증 명령의 출력으로 확인합니다.

## 명령어

```bash
# 위키 재생성 및 검증 (원자료·은행 변경 후; 재생성은 파일 변경을 만듦)
node cpa_uploader/wiki/scripts/build-wiki.mjs
node cpa_uploader/wiki/scripts/lint-wiki.mjs

# 전체 은행 검증 (source quote 실존, 발문 중복, 배점 불변식, 주제별 세트 수, public 일치)
npm run questions:v3:validate

# 상태 전환 — 이 스크립트로만 수행. 전환마다 promotions.json에 근거와 함께 기록됨.
npx tsx cpa_uploader/promote_cpa_v3.ts --status                 # 현재 상태·장부 요약
npx tsx cpa_uploader/promote_cpa_v3.ts --to verified \
  --sets pilot-01-001,pilot-01-002 \
  --evidence "2차 의미 검수 2026-08-24 (검수자: OOO)"
npx tsx cpa_uploader/promote_cpa_v3.ts --to published \
  --sets <게시할 세트 id 목록> --evidence "게시 승인"

# 신규 draft 단독 검증 (authoring에 넣기 전)
npx tsx cpa_uploader/validate_draft_v3.ts --file <draft.json>

# OpenAI로 신규 draft 생성 (기존 authoring/public/promotions는 덮어쓰지 않음)
npx tsx --env-file=.env.local cpa_uploader/generate_cpa_v3.ts --output cpa_uploader/data/cpa_question_sets_v3.generated.draft.json

# 운영 배포물 생성 (published+verified만 통과, 암호화 + round-trip 검증)
npx tsx --env-file=.env.local scripts/compile-question-bank-v3.ts
```

## 문제 제작 흐름 (수동 기준)

1. `wiki/_meta/coverage-map.md`에서 보강할 주제를 고른다.
2. 해당 `wiki/concepts/<주제>.md`의 **v3 문제은행 연결 현황**을 읽고 같은 명제를 다시 묻지 않도록 한다.
3. concept 페이지의 **원자료 탐색** 링크로 실제 기준서 텍스트(`data/회계감사_통합학습자료/`)를 확인한다.
   위키 페이지 자체는 근거가 아니며 `confidence: medium` 색인이다.
4. `wiki/question-generation/question-output-schema.md` 계약대로 draft JSON을 작성하거나 OpenAI 생성 CLI를 실행한다.
5. `validate_draft_v3.ts`로 단일 draft를 검증한 뒤 authoring 은행에 추가하고
   `questions:v3:validate`로 전체 재검증한다.
6. 사람 의미 검수 후 `promote_cpa_v3.ts`로 verified → published 승급한다.
7. `npx tsx --env-file=.env.local scripts/compile-question-bank-v3.ts`로 암호화 배포물과 public JSON을 갱신한다.

절대 규칙은 `wiki/question-generation/question-design.md`의「생성 금지」와
`wiki/question-generation/question-generation-workflow.md`의 검증 절차를 따른다.
핵심: 계산 문제 금지, 출처에 없는 수치·기간 금지, criterion은 독립 채점 가능한 최소 명제,
같은 물음 안에서 두 criterion이 같은 핵심 사실을 요구하지 않기(중복 득점 차단).
