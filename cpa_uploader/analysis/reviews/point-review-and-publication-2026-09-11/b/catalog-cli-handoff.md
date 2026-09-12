# 후속 학습 분류 카탈로그 CLI 인계

2026-09-11. 수정 범위는 [생성기](../../../../../scripts/build-learning-unit-catalog.ts)와 [대응 테스트](../../../../../tests/buildLearningUnitCatalogCli.test.ts)이다. `compileLearningCatalog` 본문은 변경하지 않았다.

- `--review <파일>`, `--output <파일>`, `--check`를 엄격히 파싱한다. 중복·알 수 없는 옵션·누락 값·여분 위치 인자를 거절한다.
- `--review`를 생략하면 선택한 output 카탈로그의 `review_file`을 읽는다. 카탈로그가 없을 때만 종전 `canonical-classification.json`을 사용한다. 잘못된 기존 카탈로그는 조용히 대체하지 않는다.
- 실제 읽은 원본 바이트의 SHA-256을 검토 파일의 값과 대조하며, 전체 물음 분류·등록 주제·학습 단위 계약은 기존 컴파일러가 계속 검증한다. 출력에는 실제 선택한 review 경로·해시를 기록한다.
- 선택 review, 기존 카탈로그에 연결된 review, 정본, source, coverage 입력과 같은 출력 경로를 거절한다. 심볼릭 링크의 실제 경로 및 하드 링크 inode도 대조한다. 기존 비카탈로그 파일을 출력으로 덮어쓰지 않는다.
- 읽은 입력·기존 출력은 생성 종료 직전 다시 해시 대조한다. `--check`는 파일을 만들거나 수정하지 않는다.

검증 결과:

- 신규 CLI 회귀 7개 + 기존 학습 단위 9개 = **16개 통과**. 임시 디렉터리에서 후속 review 지정과 재현, 기본 fallback, 입력 바이트 보존, 낡은 source hash 거절, 경로 보호, 불완전 분류·미등록 주제 거절을 확인했다.
- `npx tsc --noEmit --incremental false`: 통과.
- 생성기·대응 테스트 대상 ESLint: 통과.
- 실제 현재 카탈로그 `--check`: 통과. 212물음/212학습 단위, 기준서형208·사례형4, 주제연결253. 읽기 전용 실행이다.

| 파일 | SHA-256 |
| --- | --- |
| scripts/build-learning-unit-catalog.ts | `a7c5aaba3d609f39e7f567d9d9db819bfb5034fee08b1c24e047cb83e4695d8b` |
| tests/buildLearningUnitCatalogCli.test.ts | `0e285ebabd814c3386dc302c93034404e8709fe8c2a3a001c15f5eeb3cc26db1` |

실제 카탈로그·과거 review·문항·QA·source·의미검수/채점/DB 코드는 수정하지 않았다. API/원격 DB 호출은 0회다. 새 카탈로그를 선택·생성하는 작업은 총괄이 수행한다.
