# R02 sub2/crit9 출처 위치 조사

문단17의 등록 인용과 행 위치는 정확하다. 실제 모델 입력의 확대 발췌는 문단16의 꼬리를 앞 문맥으로 포함하지만 문단17의 전체 인용도 그대로 포함한다. 확대 발췌의 첫 문단만 보고 문단16이 잘못 연결되었다고 판단한 원시 uncertain 설명은 입력과 맞지 않는다.

직접 인용은 L147–L165, 확대 발췌는 L121–L189이다. 문단17 표제는 L147, 독립성 관련 모든 관계와 기타사항을 말하는 본문은 L154–L155에 있다. source_excerpts에 source_quote_line_start/end가147/165로 따로 제공되어 있고, known_source_metadata도17/172쪽으로 연결된다. [실제 원문·행·검사 장부](r02-crit9-source-span-report.json)에서 직접 인용의 확대 발췌 내 실존, 파일 내 연속 실존과 input/schema/instructions/content/bank/source 해시 일치를 확인했다.

유효 uncertain은 attempt2에서 나왔다. attempt1은 부분점수 계약이 없는 사례에 partial을 생성하여 거절되었고 source_support는 pass였다. 두 시도의 요청 본문·스키마는 같지만 수정 지시가 달라진다. 동일 조건의 추가 실측은 attempt2 수정 지시까지 맞추어야 한다. 이번 작업은 로컬 조사이며 새 API 호출0, 원 receipt·로그·공식 출처·문항은 그대로다.
