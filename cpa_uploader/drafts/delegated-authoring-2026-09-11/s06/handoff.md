# S06 1차 인계

**draft_ready:3세트·9물음·25criterion·25점, 작성자QA144사례. 실제모델의미검수·채점0회.**

|계획ID|실제ID|물음배점|QA|산출물|
|---|---|---|---:|---|
|T17-B|pilot-17-006|2 + 2 + 2|40|[문항](draft-pilot-17-006.json) · [계획](draft-pilot-17-006.json.authoring-plan.json) · [QA](qa-cases-t17-b.json)|
|T18-A|pilot-18-005|6 + 4 + 4|64|[문항](draft-pilot-18-005.json) · [계획](draft-pilot-18-005.json.authoring-plan.json) · [QA](qa-cases-t18-a.json)|
|T19-A|pilot-19-005|2 + 1 + 2|40|[문항](draft-pilot-19-005.json) · [계획](draft-pilot-19-005.json.authoring-plan.json) · [QA](qa-cases-t19-a.json)|

현재단일활성후보를총괄ID장부에서선택한149세트(비교146+본인3)에대해형상·원문인용·도메인·ID/발문충돌오류0. 세트별CLI3개통과,TypeScript통과. 직접35refs와수동의존문맥을실제검수입력에전달했으며입력길이는337538/260644/288371자로400000상한이내였다. 이비교본은최종49확정본이아니므로2차에새은행해시로재준비한다.

주요변경:1100.40/41번호연결정정, T17-B-Q3을낮은잔여위험A68사례로구체화,2023회사평가→감사인계획변형을partial로표시, 중간검토2015공식HWPML전문확보, 전체형식46(8)결론적용,1200숫자/법적인용확인. 세부범위·기출관계·기존criterion차이는 [범위 장부](scope-and-sources.md)에있다.

총괄후속: [coverage13관계 제안](coverage-proposal.json)을검토해공용links/snapshot에통합한다. SourceCatalog전체fingerprint가등록후변하면최종문항/계획/검수입력을다시확인한다. 모델의미검수와그생성QA뿐아니라작성자QA144전체실측·불일치수정·재채점이남아있다. 사람승인·정본편입·게시·배포는실행하지않았다. S01범위문서의S06 T18-A중간검토표기는T19-A가맞다는정정을후속문맥으로남겼다.

증거: [정적검사](static-validation-01.json) · [CLI](cli-validation-01.json) · [TypeScript](typecheck-01.json) · [공식원전](manual-source-evidence.md)
