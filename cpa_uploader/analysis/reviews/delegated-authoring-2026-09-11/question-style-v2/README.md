# 기준서형·사례형 분리 후속 v2

사용자 최신 정의에 따라 사례와의 실제 연계 필요 여부를 재대조했다. **기준서형 64물음 / 사례형 68물음**, 원49세트·132물음을 74개 학습 문제 묶음으로 나누었다. 사실관계가 있는 묶음에는 사례형만, 기준서형 묶음에는 독립 발문만 들어 있다.

- [적용 보고](../../../../../docs/reports/question-authoring-by-topic-2026-09-11/T08-C-물음-분할과-기준서형-사례형-분리.md)
- [분류 근거](classification-report.md) · [분류 입력](index.json) · [학습 묶음](learning-groups.json)
- [현재 manifest](../final-153-style-v2/manifest.json) · [입력 검사](validation.json) · [최종 검증](final-verification.json)
- [관계 경로 후속](coverage-followup.json): 과거 snapshot 보존, 관계 검토 대기 유지.

compile.mjs가 담당자별 분류 파일과 구조분할 manifest를 읽어 독립 발문 후속본·비교 은행·학습 묶음을 생성한다. 생성 JSON·표는 직접 수정하지 않는다. 기존 question-style-v1과 point-policy-v1의 문항·QA·실측은 당시 근거로 보존한다. 분류/로컬 검사 완료와 실제 모델 검증/사람 확인 완료를 구분한다. API0, 편입·게시·배포 없음.
