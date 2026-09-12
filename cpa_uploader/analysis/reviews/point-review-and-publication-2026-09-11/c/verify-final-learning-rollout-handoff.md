# 운영 반영 후 읽기 전용 확인기

`verify-final-learning-rollout.ts`는 실행 준비 완료이며 원격 실행은 하지 않았다. 원격 DB·모델 API 호출은 0이다. 실제 게시·의미검수·채점 통과를 이 유틸의 fixture 결과로 주장하지 않는다.

최종 authoring 은행, 학습 catalog, 실제 import의 `applied: true` evidence를 각각 경로와 파일 SHA-256으로 고정한다. source 원문 바이트 해시, `{sets, applicability}` 내용 해시, 공개 compile 내용 해시는 실제 import CLI의 순수 함수를 재사용한다. 수량은 이 입력에서 계산하며 특정 세트·물음 개수는 고정하지 않는다. 네이티브 분류와 기존 sidecar 분류의 우선순위도 현재 `learningCatalogForBank`를 따른다.

기본 실행은 로컬 preflight만 수행해 `prepared_not_executed`를 기록한다. `--read-live`를 명시한 경우에만 환경 설정을 읽어 다음 조회를 수행한다. 출력 경로는 새 파일이어야 하며 입력 및 기존 증거를 덮어쓰지 않는다.

```text
npx tsx cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts
  --bank <최종 authoring JSON> --expected-bank-sha256 <파일 SHA256>
  --learning-catalog <최종 catalog JSON> --expected-catalog-sha256 <파일 SHA256>
  --evidence <실제 applied receipt JSON> --expected-evidence-sha256 <파일 SHA256>
  --output <새 보고서 JSON>
```

위는 줄별 인자를 설명한 예시다. 실제 PowerShell에서는 한 명령으로 전달한다. applicability가 import에 사용됐다면 `--applicability`와 `--expected-applicability-sha256`도 동일 파일로 전달한다. 원격 확인 시에는 `--read-live --expected-project <프로젝트 ref> --migration <실제 설치 SQL 파일> --expected-migration-sha256 <SQL 파일 SHA256>`을 추가한다. evidence의 `project_host`와 환경의 Supabase 호스트가 일치해야 한다. 비밀키는 인자로 받지 않으며 출력하지 않는다.

원격 경로는 고정 SELECT 하나를 Management API에 `read_only: true`로 보내고, 현재 active release와 classification, 각 source version의 private DTO를 읽는 세 RPC만 허용한다. active pointer·봉인 메타데이터·주제 목록을 조회 전후 대조한다. 다른 RPC 이름은 fetch 이전에 거부한다. 사용자 답안·attempt·grading run·XP 테이블은 조회하거나 수정하지 않는다. 공개 응답의 비공개 필드 검사는 안전 projection 전에 원시 payload에서 수행한다. private DTO는 SQL의 선택적 null 제거·빈 answer_slots 기본값만 반영한 예상 DTO와 전 필드 해시를 비교하며 보고서에는 내용을 저장하지 않는다.

분류는 실제 source version·물음 UUID·봉인 classification UUID·내용 해시와 연결한다. 주제·사실 ID·독립 발문을 최종 catalog와 대조하고, 사례형은 해당 부모의 사례형 물음 전체, 기준서형은 사실 없는 단독 한 물음으로 학습 단위를 재구성한다. 과거 source lineage에 기준서형과 사례형이 함께 있는 경우 기준서형을 사례 자식으로 오인하지 않는다.

로컬 검증은 fixture 8개, 대상 TypeScript 검사, 대상 lint를 통과했다. 바이트가 다른 원문, 공개 답안 유출, private criterion 변조, 사례 물음 누락, 다른 source 연결, 기준서형 부모·발문·주제·사실 변조, 조회 중 metadata 변경 및 쓰기 RPC 차단을 확인했다. fetch는 fixture로 주입했으며 실제 원격 SQL 문법·접속 권한·데이터 값은 실행 전 미검증이다. 검사 기록과 파일 해시는 `verify-final-learning-rollout-evidence.json`에 남긴다.

이 도구는 최종 은행과 메타데이터의 게시 후 일치 확인용이다. 의미검수·사람 승인·실제 채점·원자료 정확성 검증을 대체하지 않으며 전역 DB 보안·과거 제출 이력 전체 감사도 범위 밖이다.
