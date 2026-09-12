# S01 — 기본원칙·품질검토·업무변경·수행중요성

**1차 `draft_ready`: 4세트·12물음·35criterion·35점, 작성자 QA195사례.** 2027년 CPA 시험 대비이며 현재 확보 공식 근거와 2026-01-01 개시 보고기간을 적용했다. 문항은 `needs_review / needs_human_review` 상태다. 실제 모델 의미검수·채점은 전체49개 비교 입력을 총괄이 고정한 뒤 진행한다.

| 계획 | 실제 ID | 물음별 점수 | QA |
|---|---|---|---:|
| T02-B | [pilot-02-007](draft-pilot-02-007.json) | 3+2+4=9 | [50](qa-cases-t02-b.json) |
| T01-B | [pilot-01-006](draft-pilot-01-006.json) | 3+4+3=10 | [51](qa-cases-t01-b.json) |
| T03-B | [pilot-03-006](draft-pilot-03-006.json) | 2+2+3=7 | [44](qa-cases-t03-b.json) |
| T04-C | [pilot-04-007](draft-pilot-04-007.json) | 3+4+2=9 | [50](qa-cases-t04-c.json) |

잠정31점에서4점 늘었다. 사후 감사평가의 절차·증거·보고서와 수행중요성 판단의 기업 이해·과거 왜곡표시·당기 예상을 독립 명제로 분리했다. 물음은12개 그대로다. [범위·빈도·기존 차이](scope-and-sources.md), [정확 공식 원문·판본](manual-source-evidence.md), [인계](handoff.md), [기계 인계](handoff.json)를 함께 읽는다.

## 검사 상태

- [최종 정적 검사](static-validation-final.json): 현재 비교 134세트와 S01 4세트를 합친 138세트의 원문·분류·정수배점·ID/발문 충돌 오류0. 계획의 모든 source ID 실존과 QA195사례의 criterion 대응·기대점수·필수 유형을 확인했다.
- 무호출 `prepareSemanticReview` 통과. 입력은 264,338 / 311,594 / 255,008 / 255,078자이며400,000자 상한을 명시했다. 자료와 비교 은행을 자르지 않았다. 공식 source_ref 47개 연결(세트별10/19/9/9)이 실제 requestContext에 전달된다. 개정220 시행표의 별도 공식 인용도 T01-B 계획 조건에 넣었다.
- [독립 초안 CLI 검사](cli-validation-final.txt)4개 통과. [TypeScript 검사](typecheck-final.txt)의 결과를 보존했다. [관계 제안](coverage-proposal.json)14건은 실제 element/source/target을 연결한 `needs_review` 제안이며 공용 coverage를 수정하지 않았다.
- 의미검수 **미실행**, 실제 모델 채점 **0/195사례**, 불일치 **미측정**. 정적 기대점수 합산을 모델 실측으로 표시하지 않는다. 최종49개 비교은행·공식 파일·코드·모델 설정 확정 후 재개한다.

## 수동 저작과 인계

각 문항 옆 `.authoring-plan.json`을 `--plan`으로 전달하는 수동 저작이다. 자동 packet을 사용하지 않았고 생성 marker를 삭제한 것이 아니다. `content-proposal.py` → `build-manual.ts` → `qa-design.py`는 배정된 ID를 사용해 이 폴더의 문항만 재현한다. 재생성 전 현재 버전과 검증 증거의 재사용 가능성을 판단한다.

[첫 통합 검사](static-validation-01.json)는 당시 작성 중이던 S05 후보의 중복 핵심사실 오류를 그대로 보존한다. 해당 작성자가 정제한 뒤 최종 통합검사는 통과했다. [초기 버전 ZIP](phase1-initial.zip)은 역사 증거이며 활성 문항으로 집계하지 않는다.

T04-C Q3와 T01-B의 보고서일 경계 등 복습 관계를 장부에 명시했다. S06에는 감사→검토 변경의 정당성/후속보고와 중간검토 수행절차의 경계를 인계한다. 정본 편입·게시·배포·사람 승인은 수행하지 않았다.
