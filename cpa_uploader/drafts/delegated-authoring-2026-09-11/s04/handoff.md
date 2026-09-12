# S04 인계

**draft_ready: 4세트·11물음·29점.** 입력은고정가능하며모델의미검수·실제채점이남았다.문항은needs_review / needs_human_review상태다.

| 계획 ID / 실제 ID | 출처·판본 | 초안 버전·해시 | 정적검사 | 의미검수 | 실제 채점 사례 수·불일치 | 남은 일 | 증거 경로 |
|---|---|---|---|---|---|---|---|
| T10-B / pilot-10-006 | 공식2025+2026문단대조 | SHA256 643dccc84920234e0ee13ae91de591b21060e82569ebeb6a6d26162930c246ae | 통과 | 미실행 | 0회 / 미확인; 작성자QA 51개 | 고정은행 의미검수·QA·불일치수정 | [문항](pilot-10-006.json), [계획](pilot-10-006.authoring-plan.json), [QA](qa-cases-t10-b.json) |
| T10-C / pilot-10-007 | 공식2025+2026문단대조 | SHA256 cc0133b173d322f4f949de9cd82fa63f7aa3c09a22a58365c10efdf907843e32 | 통과 | 미실행 | 0회 / 미확인; 작성자QA 65개 | 고정은행 의미검수·QA·불일치수정 | [문항](pilot-10-007.json), [계획](pilot-10-007.authoring-plan.json), [QA](qa-cases-t10-c.json) |
| T12-C / pilot-12-009 | 공식2025+2026문단대조 | SHA256 d3e72ee1f79ed0d574cf7df911acb5222ffccea96cb53bb5ac61bbd370a1967d | 통과 | 미실행 | 0회 / 미확인; 작성자QA 54개 | 고정은행 의미검수·QA·불일치수정 | [문항](pilot-12-009.json), [계획](pilot-12-009.authoring-plan.json), [QA](qa-cases-t12-c.json) |
| T12-D / pilot-12-010 | 공식2025+2026문단대조 | SHA256 f13e8cf2052d6a73385e13dcee3b5a618881f2f8c84f22e7926da124af5f7381 | 통과 | 미실행 | 0회 / 미확인; 작성자QA 47개 | 고정은행 의미검수·QA·불일치수정 | [문항](pilot-12-010.json), [계획](pilot-12-010.authoring-plan.json), [QA](qa-cases-t12-d.json) |

문항/계획/QA개별해시는[draft-manifest](draft-manifest.json)로고정했다. [최신정적검사](evidence/phase1/latest-static.json)는정본메모리와초기/선행비교를통과했다. 최초정적helper가R01객체를배열로가정한실패는[별도기록](evidence/phase1/preparation-failure-r01-shape.json)에보존하고읽기를정규화했다. 과거파일이나모델receipt를수정하지않았다.

R01 표본크기방향·후속사건이중일자·계속기업, N03 과거통제증거재사용·실증최소범위와별개다. N02 정보품질을전제로520 고유설계를적용한다. T10-C-Q3는기존10-002/sub2의의도된복습이며 T12-D의두물음간조건반복도신규coverage로중복합산하지않는다. S02 T07-C-Q1/Q3의N02적용복습범위는그대로유지한다.

등록·분류공통변경은총괄이수행했다.후속공통coverage통합은[13개제안](coverage-proposal.json)을검토하여snapshot과함께진행한다. 추가원출제효과성·효율성요소 element-b9aa305c562814a0는2016:4:1의독립요구를실제자료에서확인해연결했으며같은원출제를2회로세지않는다.

2차는총괄phase-two-protocol.md에따른다.최종153은행과입력manifest해시를확인하고gpt-5.6-luna·명시500000자로실행한다.수동source-bindings나unresolved조사packet을--packet으로전달하지않으며--plan과등록source_refs를이용한다.후속실행은새evidence경로이고실행중입력을덮어쓰지않는다.의미fail/uncertain과실제채점실패는분리하고미실측을통과로보고하지않는다.
