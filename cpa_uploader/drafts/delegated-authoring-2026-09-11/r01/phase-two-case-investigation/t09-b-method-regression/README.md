# T09-B 공란형 방식 설명의 비교 회귀검증

**v3 고정 환경에서 2개 답안을 각각 3회 실제 채점했으며 6회 모두 예상 1점과 일치했다.** [실측 요약](runs/v3-stable/summary.json)과 [실행 입력](runs/v3-stable/inputs.json)에 실제 모델 `gpt-5.6-luna`, runtime lock SHA-256 `d2c40e8e09a020930799847d7284c7b51ab049256fbaeb2f383a6c0d7d12eaef`, 호출 6회, 실행 오류·입력 변화 없음이 남아 있다. 간결 표현과 완전 표현 모두 c1은 met, c2·c3은 contradicted였으며 보안 플래그도 없었다. 이 표본은 간결 표현의 기대를 지지하지만 아래 해석상 제한을 없애지는 않는다.

[전용 QA](qa-method-comparison.json)는 현재 원 QA에서 가져온 간결한 답안을 그대로 보존하고, 작성·회신 방식을 모두 적은 동반 답안만 추가했다. 원 문항·계획·QA 파일은 수정하지 않았다. [준비 장부](preparation.json)는 해당 원본 및 이 비교용 QA의 SHA-256을 기록한다. 준비 당시 API 호출 0회라는 기록은 당시 상태이며, 후속 실측은 별도 `runs/v3-stable/`에 보존했다.

| 사례 | 방식 설명 | 사전 기대 |
|---|---|---|
| q1/condition-boundary | “공란형은 상대방이 직접 금액을 적으므로” | c1 met, c2·c3 contradicted, 1점 |
| q1/full-method-condition-boundary | 감사인의 금액·정보 미기재와 조회처의 직접 기재·정보 제공 요청을 모두 명시 | c1 met, c2·c3 contradicted, 1점 |

두 답안 모두 위험이 완전히 제거되고 회신율이 반드시 높아진다고 주장한다. KGA 505.A5는 검증 없이 회신할 위험의 감소 가능성과 추가 노력으로 회신율이 낮아질 수 있다는 한계를 설명하므로, 그 두 명제의 사전 기대는 모두 contradicted다. 실제 원문은 [현재 문항](../../draft-09-505-freq01.json)의 src1·q1.r1에 연결되어 있으며, [통합 장부](../ledger.json)는 공식 인용·현재 발문·criterion·전체 답안과 과거 관측을 보존한다.

원래 간결한 답안의 1점 기대는 발문에서 공란형 조회라는 범위를 정한 상태에서 상대방이 직접 금액을 적는 방식을 답안이 제시한다는 점에 근거한다. 명칭을 단순히 반복했다는 이유로 점수를 주는 것은 아니다. 다만 발문은 작성·회신 방식 모두를 요구하므로 감사인의 미기재를 직접 쓰지 않은 표현의 충족 여부에는 해석 여지가 있다. 이 한계를 숨기지 않으며, 원래 기대를 유지한 채 완전한 방식 설명과 비교한다. 마지막 모델 출력에 따라 기대값을 내리거나 원래 사례를 삭제하지 않는다.

[runner](run.ts)는 총괄이 전달한 **새 runtime lock**과 새 출력 폴더를 명시해야 실제 실행한다. 이미 사용한 v1/v2 lock은 거절한다. 실행 전과 각 호출 전후에 문항·원 QA·이 비교 QA·공통 코드·공식 출처·모델을 검증한다. 두 답안을 각각 3회씩 실제 `gradeQuestionSetV3`로 순차 실행하며, 오류나 코드 변경이 발생하면 이후 호출을 멈춘다. 원시 판단·trace·인용·합산·보안 플래그와 실제 호출 여부를 각 파일에 보존한다. 조건 경계의 not_met/contradicted 0점 동등 정책을 따르되 exact 판정 차이도 따로 남긴다.

실측 전 `run.ts --validate-only`에서 형상 오류 0, 원래 QA 사례 구조 동일, 기대점수1/1을 확인했다. 이 정적 검사 자체에서는 키를 사용하거나 API를 호출하지 않았다. 기존 v2 lock 거절 검사와 함께 [정적 검사](static-check.json)에 보존했다.

총괄의 v3 고정 및 실행 재개 지시 뒤 다음 명령으로 실행했다. 출력 폴더는 이미 존재하므로 같은 경로로 다시 실행하지 않는다.

```powershell
node --env-file=.env.local --import tsx cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-case-investigation/t09-b-method-regression/run.ts --lock cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/runtime-v3-stable/runtime-lock.json --output cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-case-investigation/t09-b-method-regression/runs/v3-stable
```

이 묶음은 두 간결표현의 차이를 분리해 검증하는 보충 자료다. 담당 전체 16세트·746개 작성자 QA와 의미검수·생성사례 실제 채점을 대체하지 않는다.
