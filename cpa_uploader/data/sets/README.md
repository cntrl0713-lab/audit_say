# 세트별 문항 파일

문제은행의 편집 원천이다. 세트(문제) 하나가 파일 하나이며, 정본 파일 `../cpa_question_sets_v3.authoring.json`은 이 파일들을 `order.json` 순서로 이어 붙여 **같은 바이트로** 다시 만드는 생성물이다. 정본 파일의 경로와 바이트가 그대로이므로 과거 receipt·manifest·읽기 전용 도구는 바뀌지 않는다. 설계와 근거는 [세트별 파일 분리 설계](../../../docs/문항-세트별-파일-분리-설계.md)에 있다.

| 경로 | 내용 |
| --- | --- |
| `case/<세트ID>.json` | 사례형 세트(모든 물음이 `question_style: case`). 사례 하나가 파일 하나다 |
| `standard/<세트ID>.json` | 기준서형 세트(모든 물음이 `question_style: standard`). 대부분 물음 하나짜리라 물음 하나가 파일 하나에 가깝다 |
| `order.json` | 정본 배열의 순서. **정렬하거나 다시 매기지 않는다.** 운영 릴리스 항목의 position 검사가 이 순서에 묶여 있다 |

- 파일 이름은 세트 ID + `.json`이고 내용은 세트 객체 하나를 `JSON.stringify(set, null, 2)`로 적은 것이다. 배치 디렉터리는 `../learning-question-classification-review.json`의 물음별 `question_style`로 정하며 혼합 세트는 거절된다.
- 정본을 쓰는 도구(`promote_cpa_v3.ts`, `correct_cpa_v3.ts publish` 등)는 같은 원자적 쓰기에서 세트 파일과 `order.json`을 함께 갱신한다. 퇴역한 세트의 파일은 지우고 새 세트는 `order.json` 끝에 붙는다.
- 세트 파일을 직접 고쳤으면 `npm run questions:v3:sets:build`로 정본을 다시 만든 뒤 `npm run questions:v3:validate:authoring`을 실행한다. 게시된 세트의 내용 변경은 여전히 [수정 패치](../../corrections/README.md)나 제작 경로의 검수·승급 계약을 따라야 하며, 파일을 고쳤다는 것만으로 검수가 되지 않는다.
- `npm run questions:v3:sets:check`가 세트 파일이 정본과 같은 바이트를 만들고 위치가 분류와 맞는지 확인한다. pre-commit 게이트가 이 검사를 실행하므로 둘이 어긋난 채 커밋할 수 없다.
