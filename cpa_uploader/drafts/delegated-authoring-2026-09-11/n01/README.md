# N01 — 1차 수동 제작 인계

**draft_ready: 4세트·12물음·36개 정수 criterion·36점.** 2027 CPA 시험 대비, 현재 확보한 공식 근거와 2026년 개시 보고기간 기준으로 작성했다. 문항의 실제 상태는 `needs_review`다. 모델 의미검수·실제 채점·사람 승인·정본 편입·게시·배포는 아직 수행하지 않았다.

| 계획·실제 파일 | 물음별 배점 | QA |
|---|---|---:|
| T02-A · [pilot-02-006](draft-pilot-02-006.json) | 3+4+2=9 | [49사례](qa-cases-t02-a.json) |
| T01-A · [pilot-01-005](draft-pilot-01-005.json) | 2+2+3=7 | [46사례](qa-cases-t01-a.json) |
| T03-A · [pilot-03-005](draft-pilot-03-005.json) | 3+6+2=11 | [56사례](qa-cases-t03-a.json) |
| T04-B · [pilot-04-006](draft-pilot-04-006.json) | 2+4+3=9 | [50사례](qa-cases-t04-b.json) |

[수동 출처·판본 장부](manual-source-evidence.md), [발문·배점·빈도·기존 차이](scope-ledger.md), [실제 출처 매핑](build-manifest.json)을 함께 읽는다. 각 문항 옆 `.authoring-plan.json`의 version 1 계획을 의미검수 CLI의 `--plan`에 전달한다. 자동 source packet은 사용하지 않았다. `content-proposal.py`와 `build-manual.ts`는 이 폴더 안의 수동 초안만 재현하며 생성 CLI의 ID 할당을 사용하지 않는다.

[최신 무호출 정적 검사](static-validation-final2.json)는 인용 실존, 등록 ID 및 연속 인용, 계획, QA 전 criterion·정수 합계, 111세트 기준선과 자체4세트의 ID·발문 중복을 통과했다. 4세트의 semantic prepare도 maxInputChars=200000을 명시하여 통과했다. 이 예산은 모델 호출이 없는 준비검사에 사용했고 비교은행은 자르지 않았다. [전체 정본과 결합한 domain 검사](authoring-domain-validation-followup.json)는 108세트·224물음·610criterion에서 오류0이다. TypeScript `npx tsc --noEmit --incremental false`도 통과했다.

초기 예산 초과와 수동 문맥 연결 과정의 검사 결과는 별도 파일로 보존했다. 최종 전체49세트 통합 뒤에는 비교은행 해시·공식 파일 변경 및 실제 모델 입력 길이를 총괄이 다시 확정한다. 특히 T03은 현재 무호출 입력195,359자로 여유가 작다. 이후 공통 runner로 의미검수와 실제 채점을 수행하고 201사례의 기대값 불일치를 고친다. `build-manual.ts` 재실행은 초안 내용을 재생성하므로 이후 수동 수정이 있으면 먼저 보존·반영해야 한다.

검토용 제안은 [source 경계](sources/catalog-boundary-patch-proposal.json)와 [보충 230 원문](sources/registration-kga230-supplement-proposal.txt)에 남겼으며 공용 파일을 이 작업자가 수정하지 않았다. KGA500의 별도 문맥은 주제02 직접 출처를 확장하지 않고 계획 `scope.conditions`에 공식 원문·위치·파일해시를 전달한다.
