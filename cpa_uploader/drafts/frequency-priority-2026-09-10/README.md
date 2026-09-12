# 요구사항별 빈도 기반 보완 출제

[문제·모범답안·선정 보고서](../../../docs/reports/question-authoring-frequency-priority-2026-09-10/README.md)

`content.mjs`는 작성 정본, `build-batch.mjs`는 개별 초안·계획·QA·빈도 연결과 읽기용 문서 생성기다. `prepare-sources.py`는 공식 파일 확인 및 발췌를 재현한다. `verify-batch.ts`는 초안·인용·계획·빈도·점수 재생을 검사한다.

재생성: `node cpa_uploader/drafts/frequency-priority-2026-09-10/build-batch.mjs`

검사: `npx tsx cpa_uploader/drafts/frequency-priority-2026-09-10/verify-batch.ts`

관계 장부의 검토 상태는 별도로 관리한다. 작성 초안이며 정본 승급·사람 승인·실제 모델 채점 완료를 의미하지 않는다.
