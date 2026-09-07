# F004 실제 원문 축약 픽스처

2026-09-08 OpenDART `document.xml`로 받은 원문에서 표지·손익·매출·인력 집계 표만 추렸다.
레이아웃 속성 일부를 제거했지만 ACODE, AUNIT, COLSPAN, ROWSPAN, 값과 단위는 유지했다.
개인 경력·보수 이름은 포함하지 않는다. 개인정보 분리 테스트는 가상 이름을 사용한다.

| 파일 | DART 접수번호 | 검증 목적 |
|---|---|---|
| samil.xml | 20250930000188 | 원 단위, 인건비·인원·투입시간 |
| samjung.xml | 20250627000781 | 백만원 단위 |
| seonmin.xml | 20250701000044 | 제1기, 천원, 결측·음수·표간 불일치 |
| declining-revenue.xml | 20250630000251 | 감소한 당기 매출과 전기 구분 |
| legacy-euc-kr.xml | 20200929000485 | 잘못된 UTF-8 선언, 실제 EUC-KR 법인명 |
| samil-2024-v18.xml | 20240930000232 | 서식 1.8, 원 단위 인건비·2024 결산일 |
| garip-2024-v18.xml | 20240701000610 | 서식 1.8, 백만원 단위 인건비·영업손실·당기순손실 |

원문 링크: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=<접수번호>`.
원본 ZIP은 `.cache/firm_collector/annual-2026-09-08/documents/`에만 보관하며 Git에서 제외한다.
