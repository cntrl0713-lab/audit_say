# runtime v6 조기진단6건 독립 확인

A는0/0/0점, B는5/5/5점으로 원기대와 전부 일치했다. 각독립실행에 최초 judgment응답1개만 있고 재시도·보안재확인·실행오류가 없다. 두세트 각각9기준,6실행의 총54기준 verdict·정수점수가 기대와 일치한다.

입력42파일의 당시hash와현행hash, runtimev6의16개코드, 저장 question/QA와원파일,현재 buildGradingPrompt/schema를 대조했다. 원 trace.response의 evidence_ids를 현행 resolveAnswerEvidence로 복원한 결과가 저장 raw_judgment와완전히 같고, applyQuestionSetJudgment의 로컬재합산 결과도 모든필드에서 저장 result와동일하다. 물음별 원시 injection/salad는모두false, 최종보안은none이다.

실측기록은 production_gradeQuestionSetV3/live_model, mock=false이며,당시해시와같은 run-author-qa.ts의 createResponse 인자가undefined임을 확인했다. 원자료를기대값으로주입한검사는아니다. 이검토에서는 API를전혀호출하지않았고 저장된모델판정의현행재처리만수행했다. 원trace형상에는공급자응답model별도필드가없으므로 model은기록된설정과실측코드경로로확인한한계를남겼다.

A의양의조건부절차누락은세번모두crit7 not_met이며,B의독립부정목적누락도세번모두crit7 not_met다. A2차의reason은null이지만현행schema가허용하고판정/합산일치에는영향없다. 나머지criterion도전수확인했고점수총합만확인한검사가아니다.

이6건은두반례의조기회귀결과이며 full canary,전체작성자QA,학습smoke나DB반영완료를의미하지않는다. 기존실측·receipt는모두그대로보존했다. verify.mjs 대상lint도통과했다.
