# 기존 배점 검토와 신규 문제 운영 DB 반영

## 2026-09-12 현재 상태 — 검증·DB 입력 완료, 조회 복원 미적용 상태로 중지

현재 모델 검증 버전은 [efficient-004](efficient-verification-2026-09-12/README.md)다. 선택 281물음의 내용·배점 검토와 고정 대표 답안 830개 검증을 완료했으며, 821개는 정확한 점수, 830개 모두 ±1점 이내다. [봉인 결과](efficient-verification-2026-09-12/sealed-results-v4/readiness.json)는 통과했다. 전체 351물음의 배점은 [이번 검토와 기존 검토의 연결](efficient-verification-2026-09-12/a/bankwide-point-coverage.md)로 빠짐없이 확인했다. 정본 설치·analysis/wiki 검사·운영 DB 입력은 완료했으나, 실제 조회에서 채점 보조조건 13개와 출처 위치 319개 누락이 발견되어 최종 운영 검증은 미완료다. 복원 SQL은 로컬 검사까지만 마치고 사용자 요청에 따라 중지했다. [구체 재개 지시서](../../../../docs/plans/question-verification-resume-after-pause-2026-09-12.md), [현재 진행 보고서](../../../../docs/reports/question-points-and-publication-2026-09-12.md)를 따른다. 아래 R4·충전 중단 기록은 과거 경과다.

## 2026-09-12 재개 초기 기록 — 과거

사용자가 인계안대로 재개를 요청했다. [재개 진행 기록](../../../../docs/reports/문항-전수검증-재개-진행-2026-09-12.md)과 [후속 실행 잠금 resume-004](execution-resumes/resume-2026-09-12-v4/resume.json)을 현재 기준으로 읽는다. 직접 출처를 보강한 후보 v8과 runtime v7을 사용하며 입력 3,065개를 고정했다. 사용자는 비용 때문에 **Luna 유지**, **물음당 ±1점 이내의 채점 편차 수용**을 확정했다. [허용 정책](grading-inference-followup-v2/minor-error-policy.json)에 따라 기대값·엄격 원판정·실제 점수를 보존하고 허용 편차를 별도로 기록한다. 문항·정답·출처·실행·보안 오류는 이 허용 범위가 아니다. Terra/Sol 비교 결과와 이전 입력·실측·인계 보고서는 과거 증거로 보존하며 현재 Luna 완료 수에 자동 합산하지 않는다.

현재 모델 실행은 API의 `credit_balance_exhausted / insufficient_quota` 응답으로 중단했다. [동일 실패 요청 진단](api-availability-v2/diagnosis.json), [완료 의미검수 12세트의 다음 채점 인계](b/r4-grading-wave-01/README.md), [선행 QA 94개·98관측의 별도 편차 평가](qa-tolerance-assessment-v1/README.md)를 확인한다. 과거 실행의 완료·불일치·부분 기록과 새 준비를 구분하며 충전 전에는 추가 API를 호출하지 않는다. [검토 HTML](c/r4-execution-v1/content-review-catalog-v1/review.html)은 내용 확인용이고 사람 승인이나 DB 반영 증거가 아니다.

## 2026-09-11 인계 상태

사용자의 후속 요청에 따라 `question-verification-2026-09-11-handoff-001`로 고정하고 전수 모델 검증은 다음 작업으로 미뤘다. [현황 보고서](../../../../docs/reports/문항-전수검증-재개-현황-2026-09-11.md), [다음 작업요구서](../../../../docs/plans/문항-전수검증-재개-작업요구서-2026-09-11.md), [문항별 진행표](verification-progress-001.md), [고정 파일 장부](verification-handoff-001.json)를 우선 읽는다. 새 `execution-resumes/handoff-001`은 입력·출력 경로만 준비한 상태다. v6 선행 a는 STOP을 첫 세트 전에 확인하여 실제 모델 API 0회로 중지했다. 과거 의미검수 pass와 채점 기록은 현재 후보의 검증 완료로 합산하지 않는다.

사용자가 기존 물음의 배점 검토·수정과 새 문제의 운영 DB 반영을 요청한 후속 작업이다. 과거 게시 금지는 이번 요청의 운영 DB 반영 범위에서 변경되었으며 운영 앱 배포까지 자동 확대하지 않는다. 2027년 CPA 적용 기준과 앞서 확정한 유형·부분점수 정책을 유지한다.

[baseline.json](baseline.json)과 [원본 정본 스냅샷](canonical-before.json)을 기준으로 기존 104세트·212물음을 빠짐없이 검토한다. 신규 49세트·132물음은 고정한 최신 manifest의 활성 파일만 사용한다. 과거 실측·receipt·실행 잠금은 변경하지 않는다.

## 담당 계약

- 공통 지침: 루트 AGENTS.md, 제작·검토 스킬, `docs/물음별-학습-단위와-분류-계약.md`의 유형·배점 계약, 원래 배정서 common.md를 읽는다.
- A: 주제01~06, B: 주제07~12, C: 주제13~19. 각 담당자는 이 폴더의 a/b/c 하위만 작성한다. 원본 정본·공개본·카탈로그·장부·DB·공통 코드는 총괄만 수정한다.
- 기준선의 모든 물음·모범답안·criterion·직접 인용과 필요한 원문을 읽는다. 기존 분류 원장을 함께 읽고 유형별 판단과 주제를 보존한다. 판본·정답을 바꾸는 쟁점은 근거와 함께 보고한다.
- 물음별 최소 충분 답안, 요구 요소, 필요 서술·추론 부담, 비슷한 요구의 배점, 유지/조정/분리 이유를 남긴다. 열거 요소 기본1점, 서술 독립 의미 단위의 정수 부분점수, 판단·근거 독립 득점을 적용한다. 의미가 성립하지 않는 조건·수식어 조각이나 사실 반복에 배점하지 않는다.
- 담당 `sets.json`에는 담당 원본 세트를 모두 담고 실제 필요한 내용·criterion·배점만 수정한다. 기존 ID·출처를 보존하고 새 criterion은 물음 안에서 충돌 없는 후속 ID를 사용한다. 공통 원자료를 수정하거나 미검수 상태를 검수 완료로 올리지 않는다.
- `audit.json`에는 전 물음의 전후 점수·결정·이유·최소 충분 답안·배점 근거·criterion 대응·변경 여부를 기록한다. `qa.json`에는 변경한 물음의 완전·부분·함축·반대·조건·빈 답안 기대값을 원문에서 먼저 정한다. 기존 유효한 반례는 보존한다.
- 이 첫 단계에서 담당자는 모델 API를 호출하지 않는다. 형상과 기대값 합산은 로컬로 확인하고 `handoff.md`에 실제 수행 범위·남은 검증을 구분한다. 총괄이 최종 비교 은행·코드·모델·출력을 새로 고정한 뒤 필요한 실제 검증을 진행한다.

검토·초안 준비, 실제 의미검수·채점, 사람 확인, 정본·운영 DB 반영은 각각 확인한다. 사용자 요청을 사람이 모든 정답을 확인한 증거로 꾸미지 않는다. 최종 결과와 적용 증거는 후속 파일에 남긴다.

## 후속 실행 범위 확정

사용자가 “필수 전수검증을 진행하고 통과 후 DB 반영”으로 확정했다. 기준선 파일의 당시 최소 API 정책은 이후 필요한 전수 의미검수·실제 채점 허용으로 변경되었다. 모델은 현행 설정인 `gpt-5.6-luna`를 유지한다. 사용자 추가 승인 질문에 인용한 수정 후보 수는 잠정값이며 실제 범위는 후속 입력에서 계산한다.

- [통합 후보 v3](prepared-reviewed-v3/summary.json): 주제별 기존 물음 전수 검토, 과도한 요구 묶음 분리, 정확한 공식 출처 사본·실제 인용 위치 보완 결과. 정본·공개본·DB 반영 상태와는 다르다.
- [출처 정정 근거](prepared-reviewed-v3/source-exactness.json): 실제 파일 부분문자열·원문 보존·인용 SHA 정정과 누락 위치의 도출 방법. 옛 후보·원문·검수 receipt를 수정하지 않았다.
- [작성자 QA 준비](qa-prepared-v1/manifest.json): 원답안과 부분정답 기대값·분리 계보를 보존한다. 기대값 합산 재생은 모델 실측이 아니다.
- [신규 문항 실행 잠금](execution-new-v1/manifest.json): 전체 후보 은행·출처·코드·모델을 고정하고 신규 문항의 실제 의미검수를 시작했다. 실행 로그와 최종 receipt의 상태를 각각 읽어야 하며 준비 완료만으로 통과를 선언하지 않는다.

동시에 실행하는 실제 검수 작업은 최대 3개다. 실행 중 고정 입력을 변경하지 않고, 후속 수정은 새 후보·새 잠금·새 출력 경로로 기록한다. 실행 장애·정답 불일치·의미검수 미통과를 구분한다. 운영 DB에는 필요한 검증과 승급 요건을 모두 충족한 결과만 반영한다.

## 현재 실행 후속

첫 실제 실행의 통과·비통과 receipt와 중단된 부분 로그는 `execution-new-v1` 및 `execution-new-resume-a-v1`에 보존한다. 해당 실행을 전수 완료로 계산하지 않는다. 검수 요청에서 물음의 criterion 보충 출처가 빠진 문제와 필수 ID 전달을 보완했고, 사례 사실·기준·적용 추론을 구분하도록 했다. 과거 기록 읽기와 신규 수락의 요건은 별개다. [코드 보완 검사](review-request-clarification-v1/after.json)와 [독립 호환 검사](c/semantic-clarification-marker-followup.md)를 참고한다.

[비교 은행 v4](prepared-reviewed-v4/summary.json)는 `pilot-08-007/sub2/crit5`와 `sub3/crit13`의 실제 중복 배점을 정리한 후속본이다. 증빙·기록기간 대조는 물음 2에 남기고 물음 3은 계획 평가·이유·검사 대상기간 보완만 요구한다. 원답안 106개를 보존한 [수정 근거](a/pilot-08-007-remediation-v1/remediation.json)와 [당시 QA](qa-prepared-v2/manifest.json)를 사용했다. 이전 은행·계획·QA를 덮어쓰지 않았다.

[전수 실행 입력 v2](execution-all-v2/manifest.json)는 119세트·280물음·1,113 criterion의 1,393개 의미검수 단위를 고정했다. [선행 3세트](execution-canary-v2/manifest.json)의 실제 모델 의미검수는 35단위 모두 통과했고, `draft-04-320-freq01`의 정식 사례 채점 19회도 통과했다. 나머지 실행에서 공식 판본 근거의 부족과 발문 범위가 넓은 문제를 발견하여 세트 경계에서 중단했다. [중단 당시 증거](execution-before-official-source-followup.json)는 이후 판본의 완료 증거로 대체하지 않는다.

## 공식 원문 직접 대조 후속

[현재 후보 v6](prepared-reviewed-v6/summary.json)는 22세트의 56개 출처 연결을 공식 전사·실제 PDF와 대조한 결과와 `pilot-03-001/sub1` 발문의 수임 적합성·법규상 예외 범위 명료화를 반영했다. 교차검토에서 발견한 `pilot-02-004/src2` 인용의 A49 결론 절단은 [별도 후속안](a/official-source-remediation-v2/proposals.json)으로 복원했다. 앞선 v5와 그 로컬 사전검사도 보존하며, v5에서는 모델 검수를 시작하지 않았다.

[출처 대조·정정 장부](prepared-reviewed-v6/official-source-corrections.json), [검수 계획 연결](prepared-reviewed-v6/plan-overrides.json), [보존된 QA의 재합산](qa-prepared-v4/manifest.json)을 새 입력으로 사용한다. 작성자 QA 6,029개는 원답안·기대 판정을 그대로 보존한 준비·합산 결과이며 정식 모델 채점 완료가 아니다. 최신 후보의 전수 실제 의미검수·채점은 별도 새 실행 증거가 필요하다. 정본·공개본·운영 DB는 아직 이번 후보로 변경하지 않았다.
