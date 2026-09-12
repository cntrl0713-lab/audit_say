# wiki·출제·검증 원자료

wiki의 기반 자료와 실제 제작·검증에 사용한 출처를 모으는 로컬 보관소다. **[수집 색인](collections/2026-09-11-initial/index.md)**에서 원래 경로와 raw 보존본을 찾는다. [매니페스트](collections/2026-09-11-initial/manifest.json)는 파일별 SHA-256·크기·역할·중복 연결·미보관 자료를 기록한다.

[KGA 250 판본 후속 수집](collections/2026-09-12-kga250-edition-followup/index.md)은 2022년 공식 개정 공고·공문·개요, 2023년 전문과 발췌·페이지·취득 계보를 보존한다. 본문의 `202X` 표기를 임의 보정하지 않고 별도 공식 시행 공고와 해당 문단을 대조한 자료다.

[KGA 800 판본 후속 수집](collections/2026-09-12-kga800-edition-followup/index.md)은 2020년 국내 800·805·810 공식 개정 공고·Word 원문과 문단 추출·전사·취득 및 검토 계보를 보존한다. 최초 `.zip` 저장명과 읽기용 `.docx` 두 쌍은 동일 바이트이며 서로 다른 판본이 아니다.

| 위치 | 용도 |
| --- | --- |
| `materials/<분류>/<해시>/<원래 파일명>` | 기존 자료에서 바이트 그대로 확보한 보존본. 한 수집 안에서 동일 바이트의 여러 경로는 하나의 파일을 공유 |
| `collections/<수집명>/inventory.json` | 수집 대상으로 확정한 원래 경로·역할과 근거 |
| `collections/<수집명>/manifest.json`, `index.md`, `verification.json` | 생성한 연결·색인·보존 검사 결과 |
| `originals/<자료-판본>/` | 앞으로 새로 확보하는 원본·추출본. 새 수집 입력에 함께 등록 |
| `collect.mjs` | 원본을 변경하지 않는 수집·검사 도구 |

`learning`은 통합학습자료, `reference`는 기반 참고자료, `official`은 공식 출처 등록 입력, `verification`은 검증 원본·추출·페이지 및 출처 계보 기록, `wiki-input`은 현행 생성 입력의 시점 사본이다. 폴더 이름만으로 공식성이나 검수 완료를 판단하지 않는다. 원문 안의 URL·판본 기록과 연결된 출처 장부를 함께 읽는다.

이번 수집은 기존 파일을 남긴 **보존 복사**다. 기존 문항·카탈로그·검수 receipt가 사용하는 경로와 원문 바이트를 유지한다. raw의 파일은 편집하지 않으며, 원문 보완이나 재추출은 새 파일·새 수집으로 기록한다. 실제 정본·분석 입력은 기존 소유 위치에서 관리한다. raw 전체를 카탈로그에 재등록하지 않는다.

[옛 경로 연결표](collections/2026-09-11-initial/path-aliases.json)는 이전 보고서·임시 경로와 같은 바이트의 현재 파일·raw 사본을 연결한다. 과거 누락 공식 원본 4개는 원 URL에서 다시 확보한 뒤 당시 해시와 일치함을 확인했다. [독립 수집 검사](../analysis/reviews/point-review-and-publication-2026-09-11/a/raw-crosscheck-v1/collection-independent-validation.json)는 실제 wiki 입력의 누락과 전체 원본·사본을 대조한 결과다.

통합학습자료 자체를 기반으로 사용한다. 사용자가 불필요하다고 확정한 최초 교재 PDF 8권은 수집 대상에서 제외한다. 기존 검증에 사용한 공식 PDF·문서·추출본은 포함한다.

수집 시각은 원래 취득일·내용 검토일이 아니다. 원본을 찾지 못했거나 URL만 남은 자료는 매니페스트의 `missing`과 수집 조사 근거를 확인한다. 학습자료를 공식 원문으로, 추출본을 원본 PDF로 대신 표시하지 않는다.

## 추가 수집과 검사

새 원본은 `originals/<자료-판본>/`에 저장한다. 수집 입력은 `version: 1`, `entries` 배열을 가지며 각 항목에 `original_path`, `category`, `role`을 작성한다. 원 URL·판본·쪽수/문단·취득/확인일·추출 방법·기반 원본은 실제 확인한 정보만 추가한다. `sha256`을 미리 기록하면 수집 직전 변경도 검출한다. 새로운 수집명으로 다음 명령을 실행한다.

```powershell
node cpa_uploader/raw/collect.mjs --input <수집입력.json> --output cpa_uploader/raw/collections/<새수집명>
node cpa_uploader/raw/collect.mjs --check --output cpa_uploader/raw/collections/2026-09-11-initial
# 수집 당시 원래 파일까지 그대로인지 추가 대조
node cpa_uploader/raw/collect.mjs --check --against-originals --output cpa_uploader/raw/collections/2026-09-11-initial
```

기존 수집 경로와 다른 바이트의 보존 파일은 덮어쓰지 않는다. 후속 작업에서 원래 입력이 바뀌어도 과거 raw 파일·매니페스트·검사 결과는 보존한다. 새 수집 후 이 안내의 색인 링크를 추가한다.

후속 수집에서 분류·원래 파일명이 같으면 기존 보존 파일의 해시를 확인해 재사용한다. 이름이나 분류가 다르면 같은 바이트의 별도 파일이 생길 수 있으므로 수집 간 중복은 전체 SHA-256으로 대조한다. 보관소 경로의 심볼릭 링크·Windows junction은 거절한다.

외부 원문·학습자료 사본은 로컬용이며 `materials`와 `originals`는 Git 추적 및 앱 배포에서 제외한다. 목록과 수집 절차는 저장소에서 관리한다. 자세한 소유권은 [자료 관리](../../docs/출제-검토-자료-관리.md), 실제 제작·검증 대조는 [공통 출처 검증 지침](../../.agents/skills/audit-question-review/references/source-evidence.md)을 따른다. 보존 검사 통과는 의미검수·실제 채점·사람 확인·게시 완료와 별개다.
