# S06 수동 원전·판본·문맥 증거

자동 생성 source packet이 아닌 수동 저작의 근거 장부다. 원전의 실제 문단을 등록 source_refs에 연결했으며 version1 계획을 통해 필수 보충문맥도 모델 입력에 전달한다. 공식 등록파일과 직접 source ID는 아래 목록을 따른다.

KGA1100/1200 선택27문단의2025·2026 전문 대조는 [비교 전문](sources/kga-edition-comparison.json)에서 확인한다. 페이지는2025전문 기준이며2026대응은27쪽 뒤다.1200.2각주 정의는 등록3의원전각주에 놓여 있어2와3을함께전달한다. 1100.43은862–863쪽연속원문, A53은운영빈도까지이어진문맥, A67~68은889쪽이다.

중간검토2015-20고시는 [FSC 다운로드 원본 HWPML](sources/interim-2015.hwp)에서추출했다. 파일확장자HWP이나HTML오류가아닌유효XML이다. 시행2015-07-01,2015-06-30타법개정·67재검토기한신설. [KICPA2014 OLE 원본](sources/interim-2014.hwp) 및 [선택문단 비교](sources/interim-edition-comparison.json)로대조했다. 9말미절제목유무를제외한선택본문은동일하다.2015공식첨부에는보론4전문이없으므로 [2014 보론4 전체](sources/interim-2014-annex4.txt)를그판본그대로보충문맥에넣었다. 과거2015미확보로그를소급변경하지않았다.

1200법적인용은 [현행 법률대조](sources/legal-edition-check.json) 및원문HTML에보존했다. 외부감사법은시행2025-04-01 법률20896호,자본시장법159조는시행2026-08-04 법률21324호의현재본문이다. 회사의질적지위는사실로주므로별도산업전체정의나법정감사의무판정을추가하지않는다. [모델에 직접 전달하는 보충문맥](sources/dependency-context.json)에는법률원문·URL·해시·보론4전체와해석범위를함께넣었다.

공식등록 요청의 입력원본·해시는 [등록제안](source-registration-proposal.json)에있고 실제ID·등록SHA는 [KGA 등록 결과](../../../analysis/reviews/delegated-authoring-2026-09-11/source-registration-s06-kga1100-1200.json) / [중간검토 등록 결과](../../../analysis/reviews/delegated-authoring-2026-09-11/source-registration-s06-interim-2015.json)를따른다.

| 세트 | 공식문단 | 실제 source ID | 파일·등록 locator |
|---|---|---|---|
|T17-B|1100.41|`src-94cdb2c41fb4dff778`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.40|`src-4410a783869aabede3`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A56|`src-352bd505217aecf8f7`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.43|`src-d63d67ce8a12c8b3d9`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A64|`src-a3821ad21262673b72`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A66|`src-33ffe46f7550aafb2b`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.10|`src-4361d8c3c9a40d4ece`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A53|`src-64ab9244a9c350b292`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.44|`src-93f870d34357262274`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A67|`src-6481da730dcc3764a8`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A68|`src-3100eccc74d0bd2e3c`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A59|`src-eac3e3e39330fbedb8`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.4|`src-9eef24ef8b69e1ccce`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.39|`src-8b5b212e504dac0495`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A52|`src-b67f8bbc990c52a59d`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A54|`src-094ddec732df5d5432`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A55|`src-ce42f4e155cd0e461e`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A57|`src-4119d769da4038372e`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A58|`src-4240733cca50215ea2`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A60|`src-f0b38bc97d8608c9a5`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A61|`src-78cedf48713112de77`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A63|`src-babce0e6af7f27680f`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T17-B|1100.A65|`src-7a40922359c675c3c1`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1100|
|T18-A|1200.2|`src-eefc15ac2516338307`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1200|
|T18-A|1200.3|`src-5d149516e009fdc5f1`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1200|
|T18-A|1200.5|`src-32dca8fe23fd2241ac`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1200|
|T18-A|1200.8|`src-a03eca7464b949b2ec`|[delegated-s06-kga1100-1200-2025.txt](../../../data/official/delegated-s06-kga1100-1200-2025.txt) · KGA 1200|
|T19-A|INTERIM.9|`src-2899b8971cf5148662`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|
|T19-A|INTERIM.7|`src-707b97d1d96294e77e`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|
|T19-A|INTERIM.8|`src-e8105e47dcacc13353`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|
|T19-A|INTERIM.46|`src-3d9af3e373a28c368c`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|
|T19-A|INTERIM.36|`src-7d26e799986a65d732`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|
|T19-A|INTERIM.20|`src-77fc58ededd58652b0`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|
|T19-A|INTERIM.19|`src-c54c6824452dc1934c`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|
|T19-A|INTERIM.1|`src-60fd33aee8139af3a3`|[delegated-s06-interim-2015.txt](../../../data/official/delegated-s06-interim-2015.txt) · 분·반기재무제표 검토준칙|

각요구의최소연속인용과실제줄범위는물음requirements에있다. 등록문단에포함된후속절제목·각주는원문대로보존했으며별도득점명제로삼지않는다. 필수의존문맥은source_refs/plan.scope.conditions로전달하고수동문서만남기는방식을쓰지않았다.
