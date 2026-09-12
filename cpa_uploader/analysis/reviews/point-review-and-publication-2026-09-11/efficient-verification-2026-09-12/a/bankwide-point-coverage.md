# 전체 후보 배점 검토 범위 연결

확인 시각: 2026-09-12T03:47:23.094Z. 확인자: `plan_foundations`(agent). **이번에 70물음을 새로 의미검수한 것이 아니라, 이전 전수 배점 검토와 현재 문항의 동일성을 대조하여 기존 근거를 이어받았다.** API 호출·문항·공통 코드 변경은 없다.

[현재 후보](../candidate-v3/candidate-authoring.json) **154세트·351물음·1298점**은 [이번 선택 범위](../candidate-v3/target-scope.json) **120세트·281물음·1119점**과 아래 **34세트·70물음·179점**으로 정확히 나뉜다. 물음 중복·누락 0, 기존 검토 미연결 0이다. [전체 상세 JSON](bankwide-point-coverage.json)에 원문별 해시·매핑·notes 전후값을 기록했다.

| 구분 | 세트 | 물음 | 점수 | 근거 |
| --- | ---: | ---: | ---: | --- |
| 이번 E 선택 검토 | 120 | 281 | 1119 | [물음별 배점 보고서](../point-allocation-review.md), [A 장부](question-reviews.json), [C 장부](../c/question-reviews.json) |
| 이전 A 검토 승계 | 8 | 16 | 43 | [audit](../../a/audit.json), [당시 후보](../../a/sets.json), [초기 인계](../../a/handoff.md) |
| 이전 B 검토 승계 | 14 | 28 | 72 | [audit](../../b/audit.json), [당시 후보](../../b/sets.json), [초기 인계](../../b/handoff.md) |
| 이전 C 검토 승계 | 12 | 26 | 64 | [audit](../../c/audit.json), [당시 후보](../../c/sets.json), [초기 인계](../../c/handoff.md) |
| 전체 | 154 | 351 | 1298 | 중복·누락 없이 한 번씩 연결 |

## 동일성 확인 결과

- 비선택 70물음의 발문·모범답안·requirements/인용·전체 criterion/배점·제약을 포함한 subquestion JSON이 당시 검토본과 모두 같다. 부모 사실과 출처 참조도 같다.
- 7세트는 전체 JSON이 같고, 27세트는 verification.notes의 경로 정정 한 항목씩만 다르다. [기존 notes 변경장부](../../prepared-reviewed-v7/notes-merge.json)의 정확한 before/after와 대조하고 역적용하면 34세트 전체가 당시 sets.json과 같다. 경로 차이를 발문·답안·점수 변경으로 취급하지 않았다.
- 이전 분류와 현재 학습 분류의 유형·주제·실제 독립 발문도 변화 0이다. 초기 A/B/C 인계에 적힌 audit.json 및 sets.json 총 6개 파일의 SHA가 현재 파일과 일치한다.
- 아래 70개 이유는 이전 담당자가 직접 남긴 **유지 이유 원문**이다. 프로그램 비교는 동일성·집합·합계를 확인했고, 새 내용 합격을 자동 생성하지 않았다.

## 비선택 70물음과 이전 유지 근거

| 물음 | 유형 | 배점(이전→현재) | 이전 담당·행 | 유지 이유 원문 |
| --- | --- | ---: | --- | --- |
| [pilot-01-001/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 4→4 | [A audit](../../a/audit.json) entries[0] | 정의의 객관적 평가 내용, 평가시점, 두 적용대상은 이미 네 독립 명제로 분리되어 있다. 유의적 판단/결론을 단어별로 추가 분해하지 않는다. |
| [pilot-01-001/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [A audit](../../a/audit.json) entries[1] | 책임 경감 여부만 묻는 단일 판단으로 1점이 적절하다. 묻지 않은 검토자 자격이나 이유를 더하지 않는다. |
| [pilot-01-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 6→6 | [A audit](../../a/audit.json) entries[4] | 네 상위 사항 안에서 자문 성격·범위·결론의 일치 확인은 별개 확인 대상이다. 기존 6점은 상위 항목 수가 아닌 독립 명제를 반영한다. |
| [pilot-01-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [A audit](../../a/audit.json) entries[5] | 의견 차이 처리·해결 정책과 절차를 따른다는 하나의 처리 원칙만 요구하므로 1점을 유지한다. |
| [pilot-02-002/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [A audit](../../a/audit.json) entries[10] | 예외적 이탈 조건과 대체 감사절차의 수행이 1점씩이다. 목적 달성은 대체절차의 필수 조건으로 묶되 별도 문서화 요구를 추가하지 않는다. |
| [pilot-02-002/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [A audit](../../a/audit.json) entries[11] | 의견변형 평가, 법규상 가능한 해지 평가, 유의적 사항 문서화의 세 의무가 분리되어 있다. 자동 해지와 구별한다. |
| [pilot-02-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [A audit](../../a/audit.json) entries[12] | 의견의 대상과 인증하지 않는 두 범주가 1점씩이다. 중요성 관점·재무보고체계는 의견 대상 명제의 정확성을 구성한다. |
| [pilot-02-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [A audit](../../a/audit.json) entries[13] | 관련성의 두 필요조건과 준수 표명의 요건이 독립적인 3점이다. 조건의 AND 관계는 전체 답안에서 보존한다. |
| [pilot-03-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [A audit](../../a/audit.json) entries[22] | 법규 적용 사실과 책임 인정/이해는 서로 다른 기록 사실이다. 두 상위 항목 속 세 명제라는 선행 검토를 유지한다. |
| [pilot-03-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [A audit](../../a/audit.json) entries[23] | 새 조건 합의와 합의서 기록은 독립 2점이다. 한 문장으로 둘 다 작성해도 각각 인정한다. |
| [pilot-04-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [A audit](../../a/audit.json) entries[30] | 자원의 성격·시기·범위를 명시적으로 세 측면으로 물어 이미 1점씩 분리되어 있다. |
| [pilot-04-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [A audit](../../a/audit.json) entries[31] | 세 절차 범주만 묻는다. 성격·시기·범위나 기준서 번호를 추가 채점하지 않는 기존 3점이 적절하다. |
| [pilot-05-004/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [A audit](../../a/audit.json) entries[42] | 행위 성격, 발생 상황, 영향 평가용 추가 정보는 세 독립 요구이다. 두 상위 절차 안의 부분점수가 이미 지원된다. |
| [pilot-05-004/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [A audit](../../a/audit.json) entries[43] | 외부 보고 의무 여부와 확립된 책임에 따른 상황 적합성이라는 두 다른 결정으로 2점이다. 무조건 보고 의무는 요구하지 않는다. |
| [pilot-06-004/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [A audit](../../a/audit.json) entries[56] | 유의적 위험과 실증절차만으로 증거 불충분한 위험이라는 두 범주로 2점이다. |
| [pilot-06-004/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [A audit](../../a/audit.json) entries[57] | 왜곡표시 발생가능성과 규모를 명시적으로 두 측면으로 물어 각 1점이 적절하다. |
| [pilot-07-001/subq1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[0] | 유의적 위험에 대한 실증절차 의무와 실증전용인 때 세부테스트 조건을 각각 1점으로 이미 분리했다. 조건은 행위의 적용범위이므로 독립 점수로 더하지 않는다. |
| [pilot-07-001/subq2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [B audit](../../b/audit.json) entries[1] | 명칭 하나를 묻고 이중목적 테스트라는 명칭 하나로 1점이다. 정의·목적·절차를 새 요구로 추가하지 않는다. |
| [pilot-07-002/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[2] | 통제 의존 기대와 실증절차만으로 증거 미입수라는 두 충분조건 각각 1점이다. 효과적 운영 기대와 의존은 같은 조건의 설명이므로 분해하지 않는다. |
| [pilot-07-002/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[3] | 중간기간 이후 유의적 변화 증거와 잔여기간 추가증거 결정은 두 독립 후속절차로 각각 1점이다. |
| [pilot-07-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[4] | 발견한 왜곡표시의 통제 효과성 시사점 평가와 미발견만으로 효과성 증거가 되지 않는 판단은 두 명제로 이미 분리했다. |
| [pilot-07-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 4→4 | [B audit](../../b/audit.json) entries[5] | 이탈·잠재영향을 알아보는 구체 질문과 의존근거·추가테스트·실증절차 필요성의 세 결정에 각각 1점이다. 질문 목적의 두 표현은 추가 열거요소가 아니다. |
| [pilot-07-004/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[6] | 07-002/sub1과 같은 330.8의 두 조건이므로 같은 2점을 유지한다. 기존 의도된 반복을 삭제하거나 신규 범위로 계산하지 않는다. |
| [pilot-07-004/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [B audit](../../b/audit.json) entries[7] | 의존 증가와 증거 설득력 증가의 관계 하나가 정답이다. 증가 방향의 양끝을 별도 점수로 쪼개면 의미가 성립하지 않는다. |
| [pilot-08-001/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[10] | 관련성·신뢰성이라는 두 고려요소 명칭을 각각 1점으로 채점한다. 정의를 요구하지 않는다. |
| [pilot-08-001/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[11] | 과소계상 테스트 방향 판단과 관련 자료의 타당한 예 하나가 각각 1점이다. 발문이 예 하나 이상을 허용하므로 예 네 개를 공동 필수 목록으로 바꾸지 않는다. |
| [pilot-08-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 4→4 | [B audit](../../b/audit.json) entries[14] | 정보 자체의 정확성·완전성 증거와 목적 적합성의 정밀도·상세도 평가가 이미 4개의 독립 점수다. 두 절차의 정확성 표현을 같은 명제로 합치지 않는다. |
| [pilot-08-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [B audit](../../b/audit.json) entries[15] | 관찰 정의 1점과 시점 한계·관찰에 따른 행동 변화 각각 1점이다. 과정/절차, 육안 등의 의미 조각은 따로 점수를 만들지 않는다. |
| [pilot-08-004/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [B audit](../../b/audit.json) entries[16] | 원천·내부통제·입수방식 세 일반화 각각 1점이다. 예외 가능성이 발문에 주어졌으므로 예외 예시나 일반적으로라는 글자 재진술을 요구하지 않는다. |
| [pilot-08-004/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 4→4 | [B audit](../../b/audit.json) entries[17] | 추출방법 명칭3과 제시된 표본추론 목적에 적합한 방법 식별1이다. 표본감사와 그 목적의 연결은 단순 명칭 나열 이상의 요구이며 한 문장으로 명칭과 연결을 충족할 수 있다. |
| [pilot-09-001/subq1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[20] | 당기말 검사로 기초재고 증거가 거의 확보되지 않는 이유와 최종 증거 미입수에 대한 보고 대응 두 명제다. 한정/의견거절은 상황별 대안이므로 각각 필수 열거점수로 만들지 않는다. |
| [pilot-09-001/subq2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[21] | 적극 회신이 더 설득력 있다는 판단과 소극 미회신으로 수령 또는 정확성 검증을 확인할 수 없다는 이유에 각각 1점이다. 원 계약이 허용하는 대안적 이유 중 하나를 두 개 공동요건으로 확대하지 않는다. |
| [pilot-09-006/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[30] | 임의 선택 아님과 실행불가능 예외가 각각 1점으로 이미 분리되어 있다. 조건을 포함한 의무 설명 한 문장으로 둘 다 충족할 수 있다. |
| [pilot-09-006/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[31] | 대체절차 수행과 그 절차로도 증거 미입수 시 의견변형을 각각 채점한다. 실재성·상태는 발문 맥락상 대체절차의 목적이며 별도 주장 열거로 요구하지 않는다. |
| [pilot-10-001/subq1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [B audit](../../b/audit.json) entries[36] | 이탈·왜곡표시 정의, 모집단 정의, 모집단 완전성 증거의 세 요구가 각각 독립 1점이다. |
| [pilot-10-001/subq2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [B audit](../../b/audit.json) entries[37] | 효율성 결론, 계층내 변동성 감소, 위험 증가 없는 표본규모 감소의 인과 사슬 3점이다. 마지막 효과가 효율성 결론을 함축해도 결론만 쓴 답과 구별하며, 위험을 유지한다는 조건은 규모 감소 효과의 한계이므로 별도 단어점수를 추가하지 않는다. |
| [pilot-10-005/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [B audit](../../b/audit.json) entries[44] | 모든 표본단위에 추출 기회가 있어야 한다는 한 요건이다. 동일 확률이라는 추가 조건을 요구하지 않는다. |
| [pilot-10-005/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[45] | 확인된 변이의 투영 제외와 미수정 변이의 합산 고려는 서로 다른 처리로 이미 각 1점이다. 변이 확인이라는 주어진 조건은 새 점수를 부여하지 않는다. |
| [pilot-11-002/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [B audit](../../b/audit.json) entries[48] | 선택 가능한 세 접근방법이 각 1점이다. 점추정/범위추정은 한 접근 안의 대안이며 수행 최소 수는 이 발문이 묻지 않는다. |
| [pilot-11-002/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [B audit](../../b/audit.json) entries[49] | 평가생략 불허 판단과 개별 합리성으로 집합·기간 편의를 배제할 수 없다는 이유가 이미 1점씩이다. 집합/전체/여러 기간은 발견 경로의 대안으로 유지한다. |
| [pilot-11-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 7→7 | [B audit](../../b/audit.json) entries[50] | 550.22의 업무팀 전달, 모든 거래 요청, 통제 실패 질문, 실증절차, 다른 미공개 위험, 필요 추가절차, 고의 미공개 영향의 일곱 행위가 독립 점수다. 신속한 전달은 제시한 전달 행위의 수행요건으로 유지하고 따로 언제인지 묻지 않은 발문에서 시점 이름만의 점수를 만들지 않는다. |
| [pilot-11-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [B audit](../../b/audit.json) entries[51] | 동등한 거래조건 주장에 대한 충분하고 적합한 증거 입수 의무 하나다. 가격/신용/수수료의 예시 세부목록을 새로 요구하지 않는다. |
| [pilot-12-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [B audit](../../b/audit.json) entries[58] | 기초데이터 신뢰성·가정 근거·평가후 추가정보의 세 절차에 각각 1점이다. 사실/정보는 동의적 범위이므로 별도 목록을 만들지 않는다. |
| [pilot-12-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 5→5 | [B audit](../../b/audit.json) entries[59] | 580.19의 토의, 성실성, 두 신뢰성, 의견조치 다섯 요구가 이미 분리되었다. 580.20의 두 경우 상세 열거는 이 발문에 없으므로 추가점수로 만들지 않으며 자동 의견거절 주장은 허용하지 않는다. |
| [pilot-13-001/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [C audit](../../c/audit.json) entries[0] | 내부감사와 전문가 이용이라는 두 독립 상황의 책임 불경감이 각각 1점이다. 전적인 책임과 불경감은 여기서는 같은 책임 지속의 설명이다. |
| [pilot-13-001/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [C audit](../../c/audit.json) entries[1] | 언급 금지 원칙(법규 예외 포함), 책임에 관한 근거, 예외 시 보고문구라는 세 요구가 이미 분리되어 있다. 예외 조건 자체를 같은 보고조치와 다시 가점하지 않는다. |
| [pilot-13-004/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [C audit](../../c/audit.json) entries[6] | 전문가 활용 여부를 결정한다는 한 결정만 요구한다. 특정 상황에서 반드시 활용한다는 결론을 새로 요구하지 않는다. |
| [pilot-13-004/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [C audit](../../c/audit.json) entries[7] | 전반적인 감사목적 적합성 평가만 묻는다. 620.12의 세부 평가속성을 답안에 요구하지 않으므로 1점이 적절하다. |
| [pilot-13-007/sub1](../candidate-v3/candidate-authoring.json) | 사례형 | 2→2 | [C audit](../../c/audit.json) entries[12] | 사례 계획의 부적절 판단과 유형1 보고서의 운영효과성 증거 한계를 각각 1점으로 평가한다. |
| [pilot-13-007/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [C audit](../../c/audit.json) entries[13] | 운영효과성 증거의 세 입수 경로가 각각 1점이다. 이용 가능한 경우라는 조건은 보고서 입수 절차에 결속한다. |
| [pilot-13-007/sub3](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [C audit](../../c/audit.json) entries[14] | 전문가적 적격성·독립성·기준 적절성이 이미 독립 배점되어 있다. |
| [pilot-13-008/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [C audit](../../c/audit.json) entries[15] | 의견변형이라는 대응과 범위제한이라는 성격을 각각 평가한다. 발문이 배제한 의견 유형 선택을 추가하지 않는다. |
| [pilot-13-008/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [C audit](../../c/audit.json) entries[16] | 법규 예외가 있는 원칙과 예외 시 책임 문구가 이미 나뉜다. 같은 법규 발동조건을 보고문구 점수와 중복 가점하지 않는다. |
| [pilot-13-008/sub3](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [C audit](../../c/audit.json) entries[17] | 보고서에 책임 불경감을 명시한다는 단일 내용만 요구한다. |
| [pilot-15-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 4→4 | [C audit](../../c/audit.json) entries[32] | 주어진 네 조합마다 의견 명칭 1점이다. 제시된 중요성·전반성을 다시 쓰는 데 점수를 주지 않는다. |
| [pilot-15-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [C audit](../../c/audit.json) entries[33] | 전반성의 세 독립 성립 경우가 각각 1점이다. 각 경우를 성립시키는 조건은 같은 명제에 유지한다. |
| [pilot-16-001/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 4→4 | [C audit](../../c/audit.json) entries[39] | 대응수치의 포함 방식·이해 목적, 비교재무제표의 비교 목적·감사 시 의견 언급이 이미 네 점으로 분리되어 있다. |
| [pilot-16-001/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [C audit](../../c/audit.json) entries[40] | 국내 외부감사법상 보고 방식 명칭 한 개만 요구하므로 1점이다. |
| [pilot-16-002/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [C audit](../../c/audit.json) entries[41] | 위험 분야·유의적 감사인 판단·사건거래 영향의 세 평가범주이다. 추정불확실성은 두 번째 범주의 포함 예시이며 별도의 필수 사례를 새로 요구하지 않는다. |
| [pilot-16-002/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [C audit](../../c/audit.json) entries[42] | 관련 공시·선정 이유·감사 대응 방법이 각각 1점이다. |
| [pilot-16-006/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [C audit](../../c/audit.json) entries[49] | 개별 KAM 단락 기술 가능 여부의 판단 한 개이다. 그 본질상 KAM 여부와 근거단락 참조는 제외 범위이다. |
| [pilot-16-006/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 3→3 | [C audit](../../c/audit.json) entries[50] | 공시·선정 이유·감사 방법의 세 내용이 독립 배점되어 있다. |
| [pilot-17-001/subq1](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [C audit](../../c/audit.json) entries[58] | 운영실태보고서 제공 거절의 감사 범위상 성격만 물으므로 범위제한 1점이다. 의견유형 등 후속 조치를 추가하지 않는다. |
| [pilot-17-001/subq2](../candidate-v3/candidate-authoring.json) | 기준서형 | 7→7 | [C audit](../../c/audit.json) entries[59] | 공식 일곱 구성요소 제목의 명칭만 묻는다. 경영진과 지배기구의 책임, 정의와 한계는 각각 하나의 공식 제목이며 제목 내부 단어를 분해해 세부내용을 추가하지 않는다. |
| [pilot-17-003/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [C audit](../../c/audit.json) entries[62] | 내부회계 의견과 재무제표 통제위험 평가라는 두 증거입수 목적이 각각 1점이다. 충분하고 적합한 증거는 각 목적을 충족하는 증거요건으로 유지한다. |
| [pilot-17-003/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 5→5 | [C audit](../../c/audit.json) entries[63] | 설계 목적·예방발견 능력·실제 운영·수행자 권한·적격성이 이미 다섯 독립 점수이다. 설계조건으로 주어진 사실은 재득점하지 않는다. |
| [pilot-18-001/subq1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [C audit](../../c/audit.json) entries[66] | 1200 적용 불가 판단과 일반기준 적용 조치가 각각 1점이다. |
| [pilot-18-001/subq2](../candidate-v3/candidate-authoring.json) | 기준서형 | 1→1 | [C audit](../../c/audit.json) entries[67] | 지정된 기준서 보론 보고서의 KAM 포함 여부만 요구하므로 1점이다. |
| [pilot-18-004/sub1](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [C audit](../../c/audit.json) entries[72] | 전체 준수 기술과 일반기준 언급이라는 두 금지 판단이 각각 1점이다. |
| [pilot-18-004/sub2](../candidate-v3/candidate-authoring.json) | 기준서형 | 2→2 | [C audit](../../c/audit.json) entries[73] | 서면합의 조건과 대체적용 방식을 이미 각각 1점으로 평가한다. 18-003/sub1도 이와 같게 복원한다. |

## 해석의 한계

이 연결로 **351물음 각각에 배점 검토 근거가 존재하고 현재 문항에 대응한다**는 범위를 확인했다. 이전 agent 검토를 사람 확인이나 이번 새 실측으로 바꾸지 않았다. 기존 판본·원문·API 검증의 한계는 당시 인계에 보존되어 있으며, 진행 중인 E281의 실제 채점과 후속 QA 정정·최종 봉인·운영 DB 반영은 별도 절차다.

현재 후보 SHA-256: `16cfa40be7e2aeb1d4543729efe17bcbbeae2da866a580c7d42f2136e29762e8`. 이 문서의 상세 JSON SHA-256: `b0943063cf7f8016436ee4d1e11344921e545b5c52db6a65b6feac322ba2cc2f`. 전체 입력 파일과 이전 인계 해시는 상세 JSON의 inputs 및 previous_review_sources를 따른다.
