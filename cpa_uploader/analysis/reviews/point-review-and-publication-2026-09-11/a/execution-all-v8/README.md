# v8 실행 사전검사 인계

119세트·280물음·1113criterion·1393의미단위와6038 작성자 QA의 로컬 사전검사를 완료했다. 최대 입력476203자(한도500000), 출처·문맥 누락0, 오류0이다. 이 단계의 API 호출은0이며 실제 모델 검증 완료를 뜻하지 않는다.

[manifest](./manifest.json)는 v7 은행·119문항·출처·분류를 그대로 쓰고, lib/questionV3Grading.ts 한 파일과 A/B/C QA·B/C 계획만 승인한 후속으로 연결한다. 116 job 객체는 완전히 같으며, 의미검수 chunk 입력은117세트가 동일하고03-001/05-003의 계획 문맥만 달라졌다. 모델receipt 재사용 여부는 이 manifest에 넣지 않았으며 별도 검증 계약을 따른다.

[최종 preflight](./preflight-attempt-2.json)와 [검사·해시 인계](./handoff.json)에 전수 결과를 기록했다. 타입/lint 및 guard fixture가 통과했고3작업자 dry-run 모두 API0·하위실행0·실행폴더미생성이다. 첫 preflight.json의 B followup_lineage 허용누락은 준비기 문제였으며 당시 코드 사본과 실패기록을 보존했다. 원본 QA/은행/계획/공통코드는 수정하지 않았다.
