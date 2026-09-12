# 원래 넓은 반대 답안의 보충 회귀

이 실행은 [원래 두 답안](exploratory-regressions.json)을 그대로 production `gradeQuestionSetV3`에 전달한다. [후속 작성자 QA](qa-cases-t02-a.json)의 49개 필수 사례에 추가하며, 그 중 두 사례를 생략하거나 역사 결과를 덮어쓰지 않는다.

- `crit1` 또는 `crit8` 대상 명제는 반드시 `contradicted`이어야 한다.
- 각 답안의 비대상 명제는 자료에 지정한 `not_met` 또는 `contradicted`만 허용한다. `met`·`partial`은 허용하지 않는다.
- 전체 답안의 최종 합계는 0점이고 보안 플래그는 `none`이어야 한다.
- 원래 기대값과의 정확한 차이는 `historical_exact_verdict_differences`로 별도 보존한다. 허용 범위 안의 변화가 원래 기대값과도 일치한 것처럼 보고하지 않는다.
- 두 사례를 각각 세 번 실행해 원시 모델 판정, trace, 최종 결과, 요청·스키마·코드·입력 해시를 저장한다. 고정 비교 은행·문항·원QA와 입력 연결을 검증하고, 전송 오류나 실행 도중 코드 변경이 있으면 추가 호출을 멈춘다.

실행 스크립트는 [run-exploratory-regressions.ts](run-exploratory-regressions.ts)다. 현재 단계에서는 `--validate-only`로 형상만 확인했으며 실제 모델은 호출하지 않았다. 총괄이 공통 변경을 조율하고 새 runtime lock으로 재개를 지시한 뒤 아래 인자를 사용한다. `<새-runtime-lock>`과 `<새-N01-출력폴더>`는 총괄이 확정한 실제 경로로 치환한다. 기존 출력 경로는 재사용할 수 없다.

```powershell
node --env-file=.env.local --import tsx cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/phase-two-followup/qa-v2/run-exploratory-regressions.ts --file cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/draft-pilot-02-006.json --cases cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/phase-two-followup/qa-v2/exploratory-regressions.json --original-qa cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/qa-cases-t02-a.json --runtime-lock <새-runtime-lock> --output <새-N01-출력폴더>
```

출력은 N01 폴더 안으로 제한된다. `inputs.json`은 원문·질문·허용범위와 해시를 보관하고 `case-0001-attempt-1.json` 형태의 파일에 개별 결과를 보관한다. `summary.json`은 계획 2사례·6실행과 실제 실행 수, 오류·중도 변경, 엄격 대상 및 허용 범위의 불일치를 구별한다. 보충 회귀 결과는 필수 808개 작성자 QA 완료 수에 섞어 집계하지 않는다.
