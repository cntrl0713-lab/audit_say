from pathlib import Path
import json, hashlib, re

ROOT = Path(__file__).resolve().parents[4]
D = ROOT / 'cpa_uploader/drafts/case-deepening-2026-09-14'
A = D / 'a'
def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def objsha(x):
    return hashlib.sha256(json.dumps(x, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def write(name, x):
    (A / name).write_text(json.dumps(x, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
catalog = read(D / 'source-catalog-final.json')
units = {u['id']: u for u in catalog['units']}
bank = read(D / 'bank-before.json')
classes = read(D / 'catalog-before.json')['classifications']
bankmap = {s['id']: s for s in bank}
styles = {(x['source_set_id'], x['subquestion_id']): x['question_style'] for x in classes}
OFF = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt'
ADV = 'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md'
EXAM = 'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md'
S = {
 '230.9': 'src-e9128a970ca5cfbc5d', '230.10': 'src-3a02c5c340fba28e3a',
 '230.11': 'src-21bdaeecb1163404d0', '230.A12': 'src-2b3f76c5dfe4b14c9f',
 '230.A14': 'src-e124af7d2c28a0da7a', '230.A15': 'src-23a6c5a4e712f7dd49',
 '330.10': 'src-16f1e240ed36a75a75', '330.16': 'src-2df915f1b289f77d67', '330.17': 'src-c48b9c5ca0213d9d3d',
 '330.A23': 'src-ad011764f8da36fee4', '330.A26': 'src-b8f91aa5296513b0ad',
 '330.A27': 'src-f5f0c173e31eb73c11', '500.A21': 'src-b9d9fd1536fedc490a',
 '260.22': 'src-3442bdca167a00275c', '260.A51': 'src-87e0ffc2e0e0549a38',
 '260.A52': 'src-85a7beba497efa1b31', '260.A53': 'src-33394d90ef79545afb',
}
official_locations = {
 '230.9': (97, 3996,4004), '230.10': (97,4005,4008), '230.11':(97,4009,4011),
 '230.A12':('101~102',4215,4244), '230.A14':(102,4251,4254), '230.A15':(102,4256,4257),
 '330.10':(340,14609,14619), '330.16':(342,14691,14695), '330.17':(342,14696,14706),
 '330.A23':(350,15017,15022), '330.A26':(350,15035,15038), '330.A27':('350~351',15039,15053),
 '500.A21':(402,17174,17179), '260.22':('172~173',7186,7195),
 '260.A51':(187,7787,7814), '260.A52':(187,7815,7820), '260.A53':('187~188',7821,7839),
}

def source_ref(key):
    u = units[S[key]]
    q = u['quote']
    # Use an exact continuous excerpt while excluding a following unrelated heading.
    if key == '230.11': q = q.split('관련 요구사항으로부터의 이탈')[0].rstrip()
    if key == '330.10': q = q.split('\r\n\r\n')[0].rstrip() if '\r\n\r\n' in q else q
    if key == '500.A21': q = q.split('외부조회')[0].rstrip()
    if key == '330.17' and q.endswith('실증절차'): q = q[:-len('실증절차')].rstrip()
    raw = (ROOT / u['file']).read_bytes().decode('utf-8-sig')
    assert q in raw, key
    page, first,last = official_locations[key]
    return dict(id=u['id'], file=u['file'], title=f"KGA {key}; 2026 전문 대조 PDF {page}쪽, 원 추출 L{first}~{last}; 등록 전사 L{u['startLine']}~{u['endLine']}",
                page=u['standard'], source_quote=q, role='standard', content_hash=hashlib.sha256(q.encode()).hexdigest(),
                source_span=f"2026 KGA {key}; PDF {page}; {OFF} L{first}~{last}; 등록 {u['file']} L{u['startLine']}~{u['endLine']}")

specs = []
specs.append(dict(
 id='case-04-documentation-trace-20260914', title='매출감사 조서의 검사대상과 토의·확인 기록', topic='04', standards=['KGA 230'],
 facts=[
 '가람회계법인은 산업용 장비 판매회사 늘봄의 2026년 12월 31일 재무제표를 감사한다. 2027년 2월 10일 담당자는 12월 매출송장 중 25건을 골라 주문서·인수증과 대조하였다. 송장에는 발행일과 고유번호가 있다. 별도로 2026년 결산조정분개장에서 매출을 증감시키는 1억원 이상 분개를 모두 검사하였다. 두 검사는 다른 절차이며, 표본규모나 회계금액을 계산할 필요는 없다.',
 '첫 조서에는 “12월 매출송장 25건 검사, 이상 없음”, 둘째 조서에는 “매출조정분개 검사, 이상 없음”이라고 적혀 있다. 실제 검사에 사용한 송장 사본과 분개장 파일은 담당자가 보관하고 있으나 조서에서 연결하지 않았다. 작성자·수행종료일·검토자·검토일·검토범위는 모두 기록되어 있다. 검토자는 조서만으로 담당자가 검사한 송장과 분개를 다시 찾아보고자 한다.',
 '2월 16일 감사팀은 영업이사 김지훈 및 회사 외부 법률고문 박은서와 특정 장비의 고객 검수조건과 매출 인식에 미치는 유의적인 영향을 토의하였다. 회사 간사가 작성한 회의록에는 토의한 조건과 쟁점, 일자 및 두 참석자의 성명·직위가 정확히 적혀 있고, 감사팀은 그 내용에 동의하였다. 팀원은 회사가 작성한 기록이므로 감사문서에 포함할 수 없으며 같은 회의를 자기 이름으로 다시 기록해야 한다고 주장하였다.',
 '다른 거래에서는 고객의 12월 이메일이 추가 검수 후에만 대금지급 의무가 생기는 것으로 읽혔다. 감사팀은 후속 확인에서 그 이메일이 초안 조건에 관한 것이었고 최종 계약과 고객의 별도 확인에는 이미 완료된 인수 조건이 적용됨을 확인하여 당기 매출이 적절하다고 결론내렸다. 이 사항은 감사팀이 유의적이라고 판단한 사항이다. 조서에는 “당기 매출 적절”이라는 최종 결론만 기재하였다. 담당자는 결론을 바꾸지 않았으므로 앞선 정보와 추가 확인 과정을 기록할 필요가 없다고 설명하였다.',
 ],
 compared=['draft-standard-additional-20260913-s03','pilot-04-004','pilot-04-005','pilot-04-006'],
 difference='230.9~11 일반 기록목록을 묻는 standard-additional-s03 및 문서화 일반요건 pilot04-004와 달리, 검사방식에 맞는 식별 특성·감사인이 동의한 회사 회의록의 사용·구체 상반정보 처리기록을 적용한다. pilot04-005/006의 보존·최종파일 취합·보고서일 후 새 절차 구별은 요구하지 않는다.',
 originals=[dict(file=ADV,start_line=7146,end_line=7160,page=218,original='mock:2023:GS2-4:4',role='context'),dict(file=ADV,start_line=7190,end_line=7191,page=219,original='mock:2023:GS2-4:4',role='prompt'),dict(file=ADV,start_line=7257,end_line=7262,page=221,original='mock:2023:GS2-4:4',role='answer')],
 discovery=['src-b477090651417dbdcc','src-a3feee84986198e10d'],
 coverage=('element-25a2ef2a822afa8d','sub1','partial','원 GS 물음의 문서화 필수기록 중 테스트 대상 식별에 대응한다. 작성·검토자와 날짜 목록까지 요구하지 않으며 회사 회의록 및 상반정보 물음을 같은 요소에 직접 편입하지 않는다.'),
 questions=[
 dict(prompt='두 검사 조서를 보완하여 검토자가 실제 검사대상을 다시 식별할 수 있게 하려면 무엇을 기록하거나 연결해야 하는지 각각 설명하시오. 작성·검토자와 날짜에 관한 기록은 묻지 않는다.',
      facts=['fact1','fact2'], topics=['04'], keys=['230.9','230.A12'],
      answers=['첫 조서는 실제 검사한 25건의 송장 발행일·고유번호 등 개별 송장을 식별할 특성을 기록하거나 해당 송장 사본 목록에 연결한다.', '둘째 조서는 2026년 결산조정분개장을 모집단으로 식별하고, 매출을 증감시키는 1억원 이상 분개 전부라는 검사 범위를 기록하거나 해당 추출내역에 연결한다.'],
      claims=[('첫 조서의 25건을 다시 찾을 수 있도록 실제 검사한 송장별 발행일·고유번호 또는 동등한 고유 식별 특성을 기록하거나 사본 목록과 연결한다. 월·건수만 반복한 답은 부족하며 날짜와 번호를 두 점으로 분할하지 않는다.','230.9',['230.A12']),('둘째 조서에 2026년 결산조정분개장이라는 모집단 및 매출 증감 1억원 이상 전부검사라는 추출 범위를 식별하여 기록한다. 해당 원천·범위를 확인할 수 있는 추출파일 연결도 인정한다. 이 하나의 검사대상 식별목적에 각 언어조각을 별도 가점하지 않는다.','230.9',['230.A12'])],
      rationale='두 감사절차의 실제 검사대상을 식별하는 기록은 각각 독립적으로 보완할 수 있다. 송장 날짜와 번호, 모집단과 추출기준은 각 기록의 특정성을 이루는 하나의 단위로 묶어 2점이다.',
      dependency='송장 일부 추출과 특정 기준 이상 분개 전부검사라는 서로 다른 방법을 지우면 어떤 식별특성이 필요한지 같은 적용답을 만들 수 없다.',
      inference='각 조서와 실제 검사방법을 대응하여 필요한 식별기록을 고르는 2단계; 2문장이 최소 답안이다.',
      partial=('첫 조서는 검사한 25건의 송장별 발행일과 고유번호를 사본 목록에 기록하고 조서에 연결한다.',['sub1.c1']),
      wrong='월과 검사 건수만 적으면 개별 송장이 식별되고, 매출조정분개라고만 쓰면 분개 모집단과 검사 범위도 식별되므로 두 조서를 보완할 필요가 없다.',
      reverse=('둘째 조서에 2026년 결산조정분개장 중 매출 증감 1억원 이상 분개 전부를 검사했다고 적는다.',['sub1.c2']),
 ),
 dict(prompt='회사가 작성한 회의록을 감사문서로 사용할 수 없다는 팀원의 주장을 평가하고, 이 회의록에 관한 사실을 근거로 설명하시오.',
      facts=['fact3'],topics=['04'],keys=['230.10','230.A14'],
      answers=['회사 작성 회의록이라는 이유만으로 감사문서에 포함할 수 없다는 주장은 부적절하다. 이 회의록을 감사문서에 포함하여 사용할 수 있다.', '회의록에 유의적인 검수조건·매출 인식 쟁점과 토의 일자·상대자가 정확히 기록되어 있고 감사팀이 그 내용에 동의하였으므로 적합한 토의 기록이 될 수 있다.'],
      claims=[('회사 작성이라는 이유로 이 회의록의 사용을 배제한 주장이 부적절하다고 판단하거나 이 회의록을 감사문서로 사용할 수 있다고 판단한다. 적합한 이유에서 사용 가능성이 명백히 함축되면 별도 결론 문구 없이 인정한다. 명시적 사용금지 결론은 이 판단점수를 인정하지 않는다.','230.A14',['230.10']),('실제 회의록에 해당 유의적 쟁점·토의시기·상대자가 기록되어 있고 감사인이 동의한 적합한 기록이라는 이유를 연결한다. 회사 작성이라는 사실의 반복만으로 부족하며 필요한 내용과 감사인의 동의는 이 기록의 적합성 근거 한 단위로 평가한다. 판단을 반대로 썼더라도 이 독립 근거가 맞으면 인정한다.','230.A14',['230.10'])],
      rationale='회의록 사용 가능성 판단 1점과 이 기록이 적합한 이유 1점이다. 구체적 문서 내용의 확인을 요구하지만 세 인적·시간적 필드를 다시 각 1점으로 늘리지 않는다.',
      dependency='회사 작성, 구체 내용의 완비, 감사인의 동의가 있는 이 회의록을 판정해야 하며 일반적인 문서화 목록으로는 적용 근거를 충족하지 못한다.',
      inference='작성 주체와 기록의 적합성을 구별한 1회 적용판단; 판단·이유 2문장.',
      partial=('이 회의록을 감사문서에 포함할 수 있다.',['sub2.c1']),
      wrong='회사가 작성한 기록은 내용이 정확하고 감사팀이 동의해도 감사문서가 될 수 없으므로 반드시 감사인이 같은 내용의 회의록을 새로 작성해야 한다.',
      reverse=('이 회의록은 감사문서로 사용할 수 없다. 다만 해당 검수조건과 매출 쟁점, 2월 16일 및 토의 상대자가 정확히 기록되고 감사팀이 동의하여 토의내용에 관한 적합한 기록이다.',['sub2.c2']),
      implicit=('검수조건·매출 쟁점과 일자·상대자가 정확히 담겨 있고 감사팀이 동의한 기록이므로, 회사가 작성한 그 회의록을 조서에 편입하면 된다.',['sub2.c1','sub2.c2']),
 ),
 dict(prompt='최종 결론이 바뀌지 않았다는 이유로 앞선 고객 이메일과 추가 확인의 처리 과정을 기록하지 않으려는 설명을 평가하고, 이 조서에 보완할 내용을 사례에 맞게 설명하시오.',
      facts=['fact4'],topics=['04'],keys=['230.11','230.A15'],
      answers=['최종 결론이 바뀌지 않았다는 이유로 유의적인 상반정보의 처리 과정을 기록하지 않아도 된다는 설명은 부적절하다.', '추가 검수를 요구하는 것으로 읽힌 12월 이메일과 당기 매출 적절이라는 결론의 불일치를, 초안 조건임을 확인한 경위 및 최종 계약·고객 확인에 따라 해소하고 결론에 도달한 과정으로 문서화한다.'],
      claims=[('해당 유의적 사항에서 결론 불변만을 이유로 불일치정보 처리기록을 생략하는 설명이 부적절하다고 판단한다. 구체 처리과정을 문서화해야 한다는 조치가 이를 함축해도 인정한다. 명시적으로 생략 가능하다고 결론내리면 이 판단은 인정하지 않는다.','230.11',['230.A15']),('12월 이메일의 추가 검수조건과 당기 매출 결론의 불일치를, 이메일이 초안 조건에 관한 것임을 확인한 경위 및 최종 계약·고객 확인에 근거하여 해소한 과정과 연결해 기록한다. 불일치 정보가 있었다는 사실이나 최종 결론만 반복한 답은 부족하다. 모든 부정확한 문서의 보존 자체를 필수요건으로 삼지 않는다.','230.11',['230.A15'])],
      rationale='생략 설명의 적절성 판단 1점과 해당 불일치의 처리 내용을 적용하여 제시하는 1점이다. 상반정보·추가증거·최종결론은 하나의 처리 경로이며 기계적으로 3점으로 분해하지 않는다.',
      dependency='초안 이메일과 최종 계약·고객 확인의 차이를 읽어 처리기록을 제안해야 한다. 기준서 문구만 반복하면 적용내용 1점을 충족하지 못한다.',
      inference='충돌한 조건과 이를 해소한 증거를 연결하는 2단계; 판단과 처리기록 2문장.',
      partial=('결론이 바뀌지 않았더라도 이 유의적 사항의 처리기록을 생략하면 안 된다.',['sub3.c1']),
      wrong='결론이 당기 매출 적절로 유지되었으므로 앞선 이메일과 추가 확인은 중요하지 않다. 최종 결론만 기록하면 충분하다.',
      reverse=('기록을 생략해도 된다. 보완한다면 이메일이 초안 조건이었음을 확인하고 최종 계약과 고객 확인에 따라 기존 결론과의 불일치를 해소한 과정을 기록한다.',['sub3.c2']),
      implicit=('초안 이메일의 추가 검수조건이 왜 최종 계약과 달랐는지, 고객 확인과 최종 인수조건으로 그 차이를 어떻게 해소해 당기 매출로 결론내렸는지 조서에 추가해야 한다.',['sub3.c1','sub3.c2']),
 ),
 ]))

specs.append(dict(
 id='case-07-control-evidence-20260914', title='구두 출고승인과 청구서 검사에서 얻은 증거', topic='07',standards=['KGA 330','KGA 500'],
 facts=[
 '감사팀은 물류회사 새길의 2026년 재무제표를 감사한다. 회사는 대형 출고 주문에 대하여 출고책임자가 주문내용을 확인하고 구두로 승인한 뒤에만 출고담당자가 차량을 출발시키는 통제를 운용한다. 감사팀은 이 통제가 적절하게 설계되고 실행된 것으로 판단하였으며 운영효과성에 의존하려 한다. 출고대장에는 차량·물량·시각이 남지만 누가 어떤 검토를 거쳐 구두승인을 했는지 기록하지 않으며, 그 승인에 관한 별도 문서도 없다.',
 '현장 방문 시 출고책임자와 출고담당자에게 질문할 수 있고 주문의 접수부터 책임자의 확인·승인 및 차량 출발까지 실제 과정을 관찰할 수 있다. 담당 회계사는 승인서가 없으므로 운영효과성에 관한 증거를 얻을 수 없다고 보고, 출고대장만 복사하여 해당 통제의 검사를 마치려 한다. 여기서는 필요한 증거수집 방법을 제안하며 그 방법 하나로 연중 통제효과성이 이미 입증되었다고 가정하지 않는다.',
 '다른 팀원은 12월 3일 오전의 출고승인 과정을 관찰하였다. 회사에는 방문 사흘 전에 관찰할 시간을 알렸고, 회사는 그 시간에 숙련된 직원을 추가 배치하여 평소와 다른 이중 확인을 실시하였다. 해당 오전에는 승인 없이 출발한 차량을 보지 못하였다. 팀원은 이 결과를 근거로 2026년의 모든 출고승인이 통제 설명과 동일하게 운영되었다고 조서에 적으려 한다.',
 '감사팀은 별도의 매입 승인통제와 관련하여 같은 구매청구서들을 이용해 승인 여부의 검사와 매입거래 금액의 세부테스트를 함께 수행하도록 설계하였다. 선택한 청구서들의 금액은 계약·입고기록과 일치하여 왜곡표시가 발견되지 않았지만, 두 청구서에는 규정상 필요한 상위 승인자의 서명이 없었다. 아직 이 서명 누락에 대한 설명이나 다른 보강증거는 얻지 않았다. 담당자는 금액 차이가 없으므로 이 검사에서 승인통제도 효과적이라고 결론내리자고 제안하였다.',
 ],
 compared=['pilot-07-003','pilot-07-006','pilot-08-003','case-13-type2-period-exceptions-20260914'],
 difference='pilot07-003은 실증절차 무오류와 통제효과의 일반 관계이고 pilot08-003/sub2는 관찰의 일반 한계이다. 기중 증거와 전기 재사용을 다룬pilot07-006 및 유형2보고서 기간·예외사례와 달리 신규는 구두 출고통제의 구체 증거방법, 예정 관찰에 따른 행동 변화, 동일 청구서의 승인과 거래금액 테스트 결과를 적용한다.',
 originals=[dict(file=ADV,start_line=2677,end_line=2718,page='84~85',original='mock:2025:GS1-3:2',role='context_and_prompt'),dict(file=ADV,start_line=2756,end_line=2780,page=86,original='mock:2025:GS1-3:2',role='answer'),dict(file=EXAM,start_line=912,end_line=931,page=29,original='cpa_exam:2025:3:3',role='adjacent_prompt'),dict(file=EXAM,start_line=1006,end_line=1028,page=31,original='cpa_exam:2025:3:3',role='answer_and_alternative_comment')],
 discovery=['src-eb785963f6a798052b','src-3fd5e2178ff309ad98','src-7aeac1ea207d693ba4','src-8a76097f53f298953d','src-200241d76e72396ac6'],
 coverage=('element-e873277b7cb2a8d5','sub1','direct','문서화가 없는 통제의 증거입수 방법이라는 GS 물음의 목표를 구두 출고승인에 적용한다. 사전 통지 관찰 한계 및 동일 청구서 두 테스트의 결과는 별도 심화 목표다.'),
 questions=[
 dict(prompt='승인에 관한 별도 문서가 없는 출고통제의 운영효과성을 테스트하기 위한 구체적인 질문 한 가지와, 그 질문에 결합할 다른 감사절차를 사례에 맞게 설명하시오. 통제에 의존할 수 있는지에 관한 최종 결론은 묻지 않는다.',
      facts=['fact1','fact2'],topics=['07','08'],keys=['330.10','330.A26','330.A27'],
      answers=['예를 들어 출고담당자에게 감사대상 기간 중 출고책임자의 구두승인을 어떻게 확인한 뒤 차량을 출발시켰는지 질문한다.', '그 질문과 함께 실제 주문 접수부터 책임자의 확인·승인 및 차량 출발까지 관찰하여, 승인 없이 출발하지 못하도록 통제가 수행되는지 확인한다.'],
      claims=[('출고책임자·출고담당자에게 해당 기간의 구두승인 운영을 확인하는 구체 질문을 한 가지 이상 제시한다. 적용방법·일관성·수행자 중 사례의 통제 운영을 검증하는 어느 한 구체 질문도 이 1점을 충족하며 세 관점을 모두 필수로 요구하지 않는다. 막연히 관계자에게 질문한다고만 쓰는 답은 부족하다.','330.10',['330.A26','330.A27']),('질문과 결합하여 실제 주문 확인·구두승인 후 차량 출발 과정을 관찰하는 구체적 절차를 제시한다. 구두승인 운영을 보강할 다른 적합하고 실행가능한 절차도 인정하되 단순 출고대장 복사나 이 사례와 무관한 컴퓨터기법 명칭만은 인정하지 않는다. 질문점수를 받지 못한 답이라도 적합한 관찰의 구체 제안 자체에는 이 독립 점수를 인정한다.','330.A27',['330.10','330.A26'])],
      rationale='구두통제 수행에 관한 구체 질문 한 가지와 실제 운영을 확인하는 관찰은 별개 증거방법으로 각각 1점이다. 질문의 적용방법·일관성·수행자는 허용되는 예이며 세 관점 전부를 1점의 숨은 조건으로 묶지 않는다. 일반적 추가증거 필요성을 별도 점수로 붙이지 않는다.',
      dependency='승인 흔적이 남지 않는 구두 통제와 실제 관찰 가능성을 읽어야 실행가능한 방법을 제안할 수 있다. ERP로그 검사를 기계적으로 대입하면 만점이 아니다.',
      inference='증거 부재의 종류를 확인하고 이용가능한 현장 절차를 선택하는 2단계; 구체 질문·관찰 2문장.',
      partial=('주문 접수부터 출고책임자의 확인과 구두승인, 차량 출발까지 현장에서 관찰하여 승인 전 출발이 차단되는지 확인한다.',['sub1.c2']),
      wrong='승인 문서가 없으면 통제의 운영효과성에 관한 증거는 어떤 방법으로도 얻을 수 없다. 출고대장만 복사하면 구두승인이 연중 일관되게 이루어졌는지도 입증된다.',
      reverse=('출고담당자에게 기중에 출고책임자의 구두승인을 어떤 방법으로 확인한 뒤 차량을 출발시켰는지 질문한다.',['sub1.c1']),
 ),
 dict(prompt='12월 3일 오전의 관찰 결과를 연중 출고승인에 그대로 적용하기 어려운 이유를 두 가지 설명하시오. 관찰한 기간과 관찰을 앞둔 회사의 준비 상황을 각각 근거에 연결하시오.',
      facts=['fact3'],topics=['08','07'],keys=['500.A21','330.A26'],
      answers=['직접 관찰한 증거는 12월 3일 오전에 한정되므로 그 관찰만으로 다른 날짜·시간을 포함한 연중 통제 운영을 입증할 수 없다.', '회사가 사전에 관찰 시간을 알고 숙련 인력과 추가 이중 확인을 배치하였으므로, 관찰받는다는 사실이 평소 수행방식을 바꾸어 그날의 결과가 일상적인 운영을 나타내지 않을 수 있다.'],
      claims=[('관찰한 12월 3일 오전의 시점 제한으로 그 밖의 연중 운영을 입증하지 못한다는 이유를 제시한다. 시점이나 기간 제한을 이 관찰 범위에 연결하면 인정하며 추가적인 부적절 판단 점수를 붙이지 않는다.','500.A21',['330.A26']),('사전 통지 후 숙련 인원 추가·이중 확인이 이루어져 관찰받는다는 사실이 평소 통제 수행방식을 바꿀 수 있었다는 이유를 제시한다. 단순히 시간이 짧다는 이유는 첫 기준과 같으므로 이 점수를 중복 부여하지 않는다.','500.A21',[])],
      rationale='관찰시점의 제한과 관찰자 존재에 의한 행동 변화는 독립 한계 각 1점이다. 같은 연중 대표성 부족을 두 문장으로 반복하면 1점이며 판단 문구에 별도 가점하지 않는다.',
      dependency='정해진 오전만 관찰했다는 사실과 사전 통지 후 평소와 다른 확인절차를 적용한 사실은 서로 다른 한계를 뒷받침한다.',
      inference='각 사실을 서로 다른 관찰 한계에 연결하는 2개 직접 적용; 2문장.',
      partial=('12월 3일 오전만 본 결과는 그 시점에 한정되므로 다른 기간까지 연중 통제 운영을 입증하지 못한다.',['sub2.c1']),
      wrong='관찰 시점을 사전에 알렸으므로 평소와 같은 행동을 보였음이 보장된다. 그 오전에 이탈이 없으면 연중 통제도 효과적이라고 확정할 수 있다.',
      reverse=('회사가 관찰 예정시간에 숙련 직원을 추가하고 평소와 다른 이중 확인을 했으므로 감사인이 지켜본다는 사실이 통제 수행방식을 바꾸었을 수 있다.',['sub2.c2']),
 ),
 dict(prompt='같은 구매청구서들을 조사하여 얻은 금액 대조 결과와 승인서명 검사 결과를 어떻게 구별하여 평가해야 하는지 설명하시오. 해당 결과만으로 모집단의 최종 이탈률이나 감사의견을 결정하지 않는다.',
      facts=['fact4'],topics=['07','08'],keys=['330.A23','330.16','330.17'],
      answers=['계약·입고기록과 청구금액이 일치한 결과는 검사한 매입거래 금액의 세부테스트 목적에 따라 평가하며, 금액 왜곡표시가 없었다는 결과를 승인통제의 효과성 증거로 대신하지 않는다.', '두 청구서의 승인서명 누락은 승인통제의 운영효과성이라는 별도 테스트 목적에 따라 통제이탈로 평가한다. 금액 대조 결과와 별도로 누락의 설명·보강증거 등을 고려하여 통제에 관한 결론을 형성해야 한다.'],
      claims=[('금액 일치·무왜곡 결과를 검사한 매입거래 금액에 관한 세부테스트 결과로 평가하고 그 결과가 승인통제의 효과성 증거를 대신하지 못함을 구별한다. 구체 거래금액 결과를 빠뜨린 일반론만은 부족하다.','330.A23',['330.16']),('두 승인서명 누락을 승인통제 운영효과성에 관한 별도 이탈로 평가하여 그에 대한 증거·설명을 고려한 통제 결론을 형성한다. 금액 무오류만으로 승인검사를 종결하지 않는다. 누락 두 건이라는 사실의 반복이나 모집단 전체 통제가 반드시 무효라는 단정만으로는 부족하다. 문단17의 세 가지 후속 결정 전부를 별도 필수 열거요건으로 요구하지 않는다.','330.A23',['330.16','330.17'])],
      rationale='거래금액과 승인통제의 서로 다른 테스트 결과를 각 목적에 맞게 평가하는 독립 의미단위 2점이다. 이중목적 명칭·동시수행 가능성·포괄적 재평가를 추가 점수로 넣지 않는다. 330.17 원문 L14696~14706을 함께 읽어 이탈의 설명·증거를 검토하는 문맥을 확인했지만, 본 물음에 문단17의 질문 및 세 후속 결정 목록을 추가 의무로 확대하지 않았다.',
      dependency='금액은 일치하지만 승인서명은 없는 상이한 결과를 읽어야 두 평가를 구별할 수 있다. 단순한 무오류 일반론만으로는 두 구체 결과 모두에 만점이 되지 않는다.',
      inference='검사목적과 해당 결과를 각각 연결하는 2개 적용; 2문장이 최소 답안.',
      partial=('계약·입고기록과 청구금액이 일치한 것은 매입거래 금액의 세부테스트 결과이며 그 무오류 결과가 승인통제의 효과성을 입증하지는 않는다.',['sub3.c1']),
      wrong='같은 청구서의 금액이 일치했으므로 두 승인서명이 없어도 승인통제는 효과적이다. 두 테스트의 목적과 결과를 따로 평가할 필요가 없다.',
      reverse=('두 승인서명 누락은 승인통제의 운영효과성과 관련된 이탈로 별도 평가하고 누락 경위와 보강증거를 검토하여 통제 결론을 형성해야 한다.',['sub3.c2']),
 ),
 ]))

specs.append(dict(
 id='case-05-governance-dialogue-20260914',title='감사위원회의 응답과 거래자료 접근 문제',topic='05',standards=['KGA 260'],
 facts=[
 '감사팀은 반도체 부품 판매회사 한울의 2026년 재무제표를 감사한다. 한울의 이사회에는 경영에 참여하지 않는 이사가 있고, 감사위원회는 재무보고를 감시한다. 한울의 주식은 별도 법인인 은솔이 모두 소유한다. 은솔 이사회는 한울 이사의 선임·해임과 자회사 재무보고 감시체계의 운영을 감독하며, 한울 감사위원회의 구성원은 은솔 이사회의 구성원이 아니다.',
 '감사팀은 2027년 2월 5일 주요 고객에게 제시한 판매장려 약정과 매출 조정의 검토 필요성을 감사위원회에 알렸다. 위원회는 다음 날 “서신을 받았다”는 답변을 보냈다. 이후 쟁점에 대한 답변이나 조치 결과는 오지 않았고, 경영진 없이 만나자는 요청에도 재무담당이사를 통해서만 질의하라고 회신하였다. 책임회계사는 수신확인을 받았으므로 지배기구와의 양방향 커뮤니케이션이 감사목적에 충분했다고 평가하려 한다.',
 '재무담당이사는 주요 고객의 판매장려 약정 원본과 수정 내역의 열람을 허용하지 않았다. 관련 매출과 장려금은 재무제표에 중요한 영향을 줄 수 있으며 감사팀은 아직 다른 원천에서 해당 약정의 내용을 확인하지 못하였다. 감사위원회에도 이 접근 문제와 필요한 자료를 구체적으로 알렸지만 위원회는 자료 확보를 위한 조치나 거래에 관한 설명을 제공하지 않았다. 감사팀은 당초 이 회사의 재무보고 감시가 원활하다는 이해를 기초로 위험을 평가하였다.',
 '감사팀은 문제를 다시 설명하고 회의 일정과 자료 제공 경로를 여러 차례 협의하려 했으나, 2월 말까지 같은 응답과 자료 차단이 이어졌다. 감사팀은 현재의 회사 내부 커뮤니케이션 절차로 이 상황을 해결할 수 없다고 판단하였다. 은솔 이사회는 아직 이 문제를 알지 못한다. 이 사례에서는 은솔 이사회에 이러한 감사상 어려움을 알리는 데 법규상 금지나 별도 제약은 없다고 가정하며, 구체적인 신고의무나 감사계약 해지의 법률요건은 판단하지 않는다.',
 ],
 compared=['draft-standard-expansion-20260913-s04','draft-standard-gap-20260913-g01','draft-standard-priority-20260914-s02','case-17-control-deficiency-20260914'],
 difference='standard-expansion-s04의260.22/A53 일반 영향·조치 열거와 달리 수신확인 후 실질 응답 부재, 원본자료 차단, 실제 외부 상위 소유주를 적용한다. g01의 효익이나 priority-s02의 소통 형식·일정 목록은 요구하지 않는다. case17-control-deficiency/sub3의 미시정 미비점 반복 서면통지와 대상·목표가 다르다.',
 originals=[dict(file=EXAM,start_line=16071,end_line=16092,page='405~406',original='cpa_exam:2018:7:3',role='context_and_prompt'),dict(file=EXAM,start_line=16167,end_line=16194,page=408,original='cpa_exam:2018:7:3',role='answer')],
 discovery=['src-75befc39644b609adf','src-007c83fff253d58032','src-f2998187574388c80e'],
 coverage=('element-f80f4843a8e4f38f','sub1','adjacent','2018 CPA 물음은 적합한 소통상대·시기·형태를 고치는 요구이며 신규는 실제 소통이 감사목적에 적절한지를 평가한다. 대상과 소통의 실질을 구별하므로 인접 관계이고 신규3물음의 직접 기출빈도로 전용하지 않는다.'),
 questions=[
 dict(prompt='수신확인을 받았으므로 양방향 커뮤니케이션이 감사목적에 충분했다는 책임회계사의 평가를 검토하시오. 감사위원회의 실제 대응에 근거하여 판단과 이유를 설명하시오.',
      facts=['fact2'],topics=['05'],keys=['260.22','260.A51'],
      answers=['수신확인만으로 이 사례의 양방향 커뮤니케이션이 감사목적에 충분했다고 평가하는 것은 부적절하다.', '감사위원회가 제기된 약정·매출 쟁점에 관해 실질적인 답변이나 조치를 제공하지 않고 경영진 없는 면담도 피하였다는 정황을 보면, 감사인의 문제 제기에 개방적으로 참여하여 소통 목적을 달성하였다고 볼 수 없기 때문이다.'],
      claims=[('수신확인만으로 이 사례의 양방향 소통이 충분했다고 본 평가가 부적절하다고 판단한다. 구체 이유가 그러한 부적절성을 분명히 함축하면 판단문구 없이 인정한다. 명시적으로 충분했다고 결론내리면 이 판단은 인정하지 않는다.','260.22',['260.A51']),('약정·매출 쟁점에 대한 답변·조치 부재 또는 경영진 없는 면담 회피 중 실제 정황을 소통의 적시성·개방성·실질 참여 부족에 연결한다. 둘 모두를 필수 열거하도록 요구하지 않으며 각 정황에 별도 점수를 더하지 않는다. 명시적 반대 결론이 있어도 독립 근거가 맞으면 인정한다.','260.A51',['260.22'])],
      rationale='적절성 판단 1점과 실제 대응에서 도출한 소통 부족의 이유 1점이다. 조치·개방성·면담 요인을 전수 열거시키거나 같은 부족 판단의 다른 표현으로 배점을 늘리지 않는다.',
      dependency='수신확인과 실제 쟁점 대응 사이의 차이를 읽어야 이 소통의 적절성을 판단할 수 있다. 일반적인 양방향 소통 효익 목록으로는 사례 근거를 충족하지 못한다.',
      inference='수신확인과 실질 대응을 구별하여 적절성을 평가하는 1회 판단; 2문장.',
      partial=('수신확인만으로 충분한 양방향 커뮤니케이션이었다고 평가하는 것은 부적절하다.',['sub1.c1']),
      wrong='서신을 받았다는 회신이 있으므로 쟁점에 답하거나 경영진 없는 면담을 할 필요가 없다. 이 회사의 양방향 커뮤니케이션은 감사목적에 충분하다.',
      reverse=('소통은 충분했다. 다만 감사위원회가 약정 쟁점에 실질적인 답변이나 조치를 주지 않고 경영진 없는 면담을 피하여 실질 참여와 개방성이 부족했다.',['sub1.c2']),
      implicit=('약정 쟁점에 응답하거나 조치하지 않고 경영진 없이 만나지도 않아 실질적인 참여와 개방성이 부족하므로, 수신확인만으로 소통 평가를 종결해서는 안 된다.',['sub1.c1','sub1.c2']),
 ),
 dict(prompt='판매장려 약정 자료의 차단과 감사위원회의 대응을 고려하여, 이 소통 문제가 감사인의 위험평가와 감사증거 입수에 미치는 영향을 각각 어떻게 평가해야 하는지 사례와 연결하여 설명하시오.',
      facts=['fact2','fact3'],topics=['05','06','08'],keys=['260.22','260.A52'],
      answers=['약정자료 접근 문제를 해결하지 않는 감사위원회의 태도가 재무보고 감시 등 통제환경의 취약함을 시사하는지 검토하여, 당초 원활한 감시를 전제로 한 중요왜곡표시위험 평가에 미치는 영향을 평가한다.', '중요한 판매장려 약정 원본·수정 내역에 접근할 수 없고 다른 원천의 확인도 없는 상황이 관련 매출·장려금에 관하여 충분하고 적합한 감사증거를 입수하는 능력에 미치는 영향을 평가한다.'],
      claims=[('감사위원회가 약정자료 접근 문제를 해결하지 않는 정황을 재무보고 감시·통제환경의 취약성 가능성과 연결하여 당초 중요왜곡표시위험 평가에 미치는 영향을 평가한다. 위험을 재평가한다는 일반 표현만으로는 사례 연결을 대신하지 못한다. 위험이 무조건 특정 수준으로 상승한다고 확정할 필요는 없다.','260.22',['260.A52']),('중요한 판매장려 약정 원본·수정 내역의 열람 차단 및 다른 원천 확인 부재가 해당 매출·장려금에 대한 충분하고 적합한 감사증거 입수 능력에 미치는 영향을 평가한다. 구체 영향평가를 충족하면 일반적인 추가 고려를 별도 가점하지 않는다.','260.22',['260.A52'])],
      rationale='통제환경을 통한 위험평가 영향과 거래자료 차단을 통한 증거입수 능력의 영향은 서로 다른 평가대상으로 각1점이다. 두 영향은 하나의 소통문제 평가라는 목표이며 개별 후속절차·의견을 더 묶지 않는다.',
      dependency='당초 원활한 감시라는 위험평가 전제와 중요한 약정 원본의 실제 접근 제한이 각각의 평가에 필요하다.',
      inference='하나의 소통문제가 감시와 정보접근이라는 서로 다른 경로로 감사에 미치는 영향을 연결하는2단계; 각1문장.',
      partial=('약정자료 차단을 해결하지 않는 감사위원회의 태도가 재무보고 감시와 통제환경의 취약성을 시사하는지 검토하여 원활한 감시를 전제로 한 중요왜곡표시위험 평가에 미치는 영향을 평가한다.',['sub2.c1']),
      wrong='자료 차단은 회사 내부 사정이므로 위험평가나 증거입수 능력에 영향을 줄 수 없다. 감사위원회가 수신확인했으므로 기존 계획을 그대로 유지하면 된다.',
      reverse=('중요한 판매장려 약정 원본과 수정내역을 보지 못하고 다른 원천의 확인도 없으므로 관련 매출·장려금에 충분하고 적합한 증거를 입수할 능력에 미치는 영향을 평가한다.',['sub2.c2']),
 ),
 dict(prompt='회사 내부 커뮤니케이션으로 자료 차단 상황을 해결할 수 없다는 판단에 이르렀다. 제시된 소유구조에서 활용할 수 있는 추가 커뮤니케이션 상대방과 전달할 사안을 제시하시오. 감사의견 변형·해지·법적 신고조치의 선택은 묻지 않는다.',
      facts=['fact1','fact3','fact4'],topics=['05'],keys=['260.22','260.A53'],
      answers=['한울의 외부 상위 소유주인 은솔의 이사회에, 한울의 판매장려 약정 자료 접근 차단과 감사위원회와의 소통으로도 그 문제가 해결되지 않는 상황을 알리는 조치를 취할 수 있다.'],
      claims=[('제시된 기업 외부 상위 소유주인 은솔의 이사회에 판매장려 약정자료 접근 차단 및 한울 감사위원회와의 소통으로도 해결되지 않는 문제를 알리는 구체 조치를 제시한다. 상대방과 전달 사안은 하나의 사례 적용 조치를 특정하는 요소이며 별도2점으로 분할하지 않는다. 막연한 추가조치·외부기관 검토 또는 기존 한울 재무담당이사에게 다시 묻는 답은 이 기준을 충족하지 못한다. 가능한 조치로 표현하면 충분하며 모든 상황에서 반드시 은솔에 보고해야 한다는 보편 의무를 요구하지 않는다.','260.A53',['260.22'])],
      rationale='실제 외부 상위 소유주에 해결되지 않는 자료 차단을 알리는 단일 조치1점이다. 포괄적인 추가조치 필요 판단과 구체 조치를 중복 가점하지 않는다.0과1사이 정수 부분점수는 없어 대표 부분정답을 만들지 않는다.',
      dependency='은솔의 소유·감시권한과 한울과 별개의 이사회라는 지배구조 및 회사 내부 해결 불가능 판단을 읽어야 이 상대방을 선택할 수 있다.',
      inference='소유구조에서 회사 외부의 상위 소유주를 고르고 해결되지 않는 감사상 어려움을 특정하는1개 조치; 1문장.',
      partial=('한울의 재무담당이사에게 판매장려 약정자료를 다시 요청한다.',[]),
      wrong='한울 내부에서 답변을 받지 못했더라도 회사 밖의 소유주인 은솔 이사회에는 이 상황을 알릴 수 없다.',
      boundary=('은솔 이사회에 판매장려 약정자료 차단과 한울 감사위원회와의 소통으로도 해결되지 않은 상황을 알릴 수 있다.',['sub3.c1']),
 ),
 ]))

point_comparisons = {
 'case-04-documentation-trace-20260914': [('draft-standard-additional-20260913-s03','sub1','일반6기록 대신 실제 두 검사대상 식별에 한정하여2점'),('draft-standard-additional-20260913-s03','sub2','일반4정보 목록 대신 회사 회의록 사용 판단과 적합성 근거2점'),('draft-standard-additional-20260913-s03','sub2','상반정보 처리 요구를 구체화하되 판단과 해당 처리기록2점')],
 'case-07-control-evidence-20260914': [('pilot-07-002','sub1','통제테스트의 일반 수행조건과는 다른2개 증거방법; 구체 질문 하나와 관찰 각각1점'),('pilot-08-003','sub2','기존 정의1+한계2에서 정의를 요구하지 않고 사례 한계2점'),('pilot-07-003','sub1','기존 무왜곡과 통제효과 일반론을 같은 청구서의 서로 다른 결과평가2점으로 적용')],
 'case-05-governance-dialogue-20260914': [('draft-standard-expansion-20260913-s04','sub1','기존6요소 일반목록을 재열거하지 않고 적절성 판단과 실제 근거2점'),('draft-standard-expansion-20260913-s04','sub1','기존 두 영향평가를 각각 해당 감시·자료차단 사실에 적용하여2점'),('draft-standard-expansion-20260913-s04','sub1','기존4대안 조치 중 실제 소유구조에 맞는 한 경로만 요구하여1점; 포괄 고려와 구체조치 중복가점 없음')],
}
sets, design, review, qa, coverage = [],[],[],[],[]
used_files={OFF,ADV,EXAM,'cpa_uploader/analysis/question-elements/question-elements.json','cpa_uploader/drafts/frequency-gap-2026-09-10/draft-05-260-001.json'}
elements=read(ROOT/'cpa_uploader/analysis/question-elements/question-elements.json')['elements']
elementmap={e['id']:e for e in elements}

for spec in specs:
    keys=list(dict.fromkeys(k for q in spec['questions'] for k in q['keys']))
    refs=[source_ref(k) for k in keys]
    refmap={x['id']:x for x in refs}
    used_files.update(x['file'] for x in refs)
    setobj=dict(schema_version='3.0',id=spec['id'],type='linked_question_set',status='needs_review',title=spec['title'],
        classification=dict(topic_id=spec['topic'],part='PART2',chapter={'04':'계획·문서화·중요성','05':'부정·법규·지배기구 커뮤니케이션','07':'평가위험 대응·통제테스트·실증절차'}[spec['topic']],domain='audit',standards=spec['standards'],tags=['사례형','사례 심화']),
        source_refs=refs,shared_context=dict(facts=[dict(id=f'fact{i+1}',text=t,scoreable=False) for i,t in enumerate(spec['facts'])]),learning_order=['sub1','sub2','sub3'],subquestions=[],
        verification=dict(source_fidelity='reconstructed',review_status='needs_human_review',calculation_required=False,notes=['2026-09-14 사용자 사례형 추가 제작 요청에 따른 독립 수동 초안. 기출·고급연습 원발문/해설 및 공식2026문단을 대조하였다.','2026년1월1일 개시 보고기간에 대한 기준을 적용하며 미래 시험판본 확정과 구별한다.','agent 의미검수·작성자 기대값은 a/review.json 및 a/qa.json. 실제모델채점·사람확인·정본승급은 이 초안의 상태와 별개이다.']))
    qdesign=[]
    for idx,q in enumerate(spec['questions'],1):
        qid=f'sub{idx}'
        reqs=[dict(id=f'{qid}.req{i+1}',source_ref_id=S[k],source_quote=refmap[S[k]]['source_quote'],source_span=refmap[S[k]]['source_span']) for i,k in enumerate(q['keys'])]
        reqmap={k:reqs[i]['id'] for i,k in enumerate(q['keys'])}
        criteria=[]
        for i,(claim,key,extra) in enumerate(q['claims'],1):
            cid=f'{qid}.c{i}'
            criteria.append(dict(id=cid,requirement_id=reqmap[key],claim=claim,critical_facts=[dict(id=cid+'.fact',type='conclusion' if '판단' in claim else 'action',expected=claim)],max_points=1,scores=dict(met=1,not_met=0,contradicted=0),source_ref_ids=[S[k] for k in [key]+extra]))
        question=dict(id=qid,type='descriptive',question_style='case',topic_ids=q['topics'],prompt=q['prompt'],selection=dict(type='all',n=None),constraints=dict(ordered=False,max_entries=None,overflow_policy='none'),model_answer=q['answers'],requirements=reqs,criteria=criteria)
        setobj['subquestions'].append(question)
        points=len(criteria)
        regressions=[]
        for label,ans,met in [('model_answer','\n'.join(q['answers']),[c['id'] for c in criteria]),('empty','',[]),('reverse_partial',*q.get('reverse',q['partial']))]:
            regressions.append(dict(kind=('boundary_incomplete' if points==1 and label=='reverse_partial' else label),answer=ans,expected_points=len(met),met_criterion_ids=met,method='author_content_expectation',actual_model_grading=False))
        for label in ['implicit','boundary']:
            if label in q:
                ans,met=q[label];regressions.append(dict(kind=label,answer=ans,expected_points=len(met),met_criterion_ids=met,method='author_content_expectation',actual_model_grading=False))
        for kind,answer,met in [('partial',*q['partial']),('wrong',q['wrong'],[])]:
            if points == 1 and kind == 'partial': continue
            actualkind='boundary_wrong' if points==1 and kind=='partial' else kind
            qa.append(dict(set_id=spec['id'],subquestion_id=qid,kind=actualkind,answer=answer,expected_points=len(met),met_criterion_ids=met,reason=(f'내용 대조에 따라 {", ".join(met)}만 충족한다.' if met else '사례 적용 명제를 충족하지 않는다. 금액합산을 실행한 결과가 아니라 공식원문·답안·criterion에 따른 작성자 기대값이다.'),single_point_no_partial=points==1))
        qdesign.append(dict(subquestion_id=qid,question_style='case',topic_ids=q['topics'],fact_ids=q['facts'],learning_objective=q['prompt'],max_points=points,minimal_sufficient_answer=q['answers'],fact_dependency_rationale=q['dependency'],point_rationale=q['rationale'],point_decision='유지',response_and_inference_burden=q['inference'],overload_decision='한 목표 안의 판단·근거 또는 같은 목적의 독립 적용이며 추가 목표를 합치지 않는다.',criterion_mapping=[dict(criterion_id=c['id'],points=1,fact_ids=q['facts'],claim=c['claim'],direct_source_ref_ids=c['source_ref_ids']) for c in criteria],local_regression_expectations=regressions,partial_scoring_contract='각 독립 명제1점. 함축된 결론 인정, 명시적 반대 결론은 판단0이나 별도 맞는 근거는 보존. 실제API호출 아님.'))
        review.append(dict(set_id=spec['id'],subquestion_id=qid,reviewer_id='agent:/root/next_cases_early',method='agent_content_review',human_review_performed=False,actual_model_grading='not_run',rationale=q['rationale'],point_decision=f'유지: 독립 의미단위 {points}개 각1점.',max_points=points,fact_ids=q['facts'],question_style='case',topic_ids=q['topics'],minimal_sufficient_answer=q['answers'],checks={k:'pass' for k in ['source','answer','prompt','points','style','topics','edition','nonduplication']},
          check_rationales=dict(source='공식2026 본문과 적용자료를 실제 대조하였다. '+ '; '.join(refmap[S[k]]['source_span'] for k in q['keys']),answer=f'저장 모범답안 {points}점, 대표답 qa 및 역방향 부분·함축·명시반대·빈답 기대값을 본문과 대조하였다. '+q['rationale'],prompt=q['prompt']+' 위 발문에서 요구한 의미만 criterion으로 배점한다.',points=q['rationale'],style=q['dependency'],topics='실제 요구는 '+','.join(q['topics'])+' 주제의 문서화·위험대응·증거 또는 소통 판단에 해당한다. 대표주제로 일괄 복사하지 않는다.',edition='2026 공식 전문의 해당 요구·적용자료와 현등록의 동일 답안 내용을 대조했다. 신규8문단은 root의 원PDF 시각대조·raw등록 근거를 별도로 연결하며 agent검토를 사람확인으로 표시하지 않는다.',nonduplication=spec['difference']),unresolved=[],unresolved_content_findings=[],question_content_sha256=objsha(question),source_quote_hashes={S[k]:refmap[S[k]]['content_hash'] for k in q['keys']}))
    for qd, (sid, sqid, reason) in zip(qdesign, point_comparisons[spec['id']]):
        oldq=next(q for q in bankmap[sid]['subquestions'] if q['id']==sqid)
        qd['point_comparison']=dict(set_id=sid,subquestion_id=sqid,existing_points=sum(c['max_points'] for c in oldq['criteria']),new_points=qd['max_points'],decision_reason=reason)
    sets.append(setobj)
    currenthash=objsha(setobj)
    for entry in review:
        if entry['set_id']==spec['id']:entry['set_content_sha256']=currenthash
    compared=[]
    for sid in spec['compared']:
        e=bankmap[sid]
        compared.append(dict(set_id=sid,title=e['title'],content_sha256=objsha(e),questions=[dict(id=q['id'],question_style=styles[(sid,q['id'])],prompt=q['prompt'],model_answer=q['model_answer'],points=sum(c['max_points'] for c in q['criteria']),criterion_ids=[c['id'] for c in q['criteria']]) for q in e['subquestions']]))
    originals=[dict(**l,file_sha256=sha(ROOT/l['file'])) for l in spec['originals']]
    sourceids=[S[k] for k in keys]+spec['discovery']
    assert all(i in units for i in sourceids)
    design.append(dict(set_id=spec['id'],plan=dict(version=1,topic_id=spec['topic'],mode='adapt_existing_question',objective=spec['title'],scope=dict(actors=['감사팀','사례에 명시한 회사 인원과 상대방'],timing=['2026년 개시 재무제표 감사'],conditions=spec['facts'],exceptions=['같은 의미를 표현만 바꾸어 중복 배점하지 않는다. 가능한 조치와 일률적 수행의무를 구별한다.'],required_answers=[q['prompt'] for q in spec['questions']],exclusions=['계산·표본규모·발문이 제외한 의견 및 법규 세부판단']),question_types=['descriptive'],source_unit_ids=sourceids,existing_question_difference=spec['difference'],edition_assumption='2026년 개시 보고기간에 적용하는 KICPA2026전문. 시험적용판본 확정과 구별한다.',unresolved_items=[],status='ready'),bank_sha256=sha(D/'bank-before.json'),source_catalog_sha256=sha(D/'source-catalog-final.json'),facts_chars=len('\n'.join(spec['facts'])),facts_counting='LF join, spaces included, Unicode code points',compared_existing_sets=compared,source_locations=originals,official_edition_comparison=[dict(key=k,source_ref_id=S[k],official_file=OFF,official_file_sha256=sha(ROOT/OFF),pdf_pages=official_locations[k][0],start_line=official_locations[k][1],end_line=official_locations[k][2],finding='기존2025등록은2026본문과같은요구를직접확인; 신규2026등록은완결본문및관련자료와대조',footnote_dependency_scope='사례에 필요하지 않은 다른 절차의 예시·각주는 새 요구로 확대하지 않는다.') for k in keys],questions=qdesign,authoring_method='manual',human_review_performed=False,actual_model_grading='not_run'))
    eid,qid,relation,reason=spec['coverage'];el=elementmap[eid]
    coverage.append(dict(element_id=eid,element_snapshot_sha256=objsha(el),source_unit_ids=sourceids,set_id=spec['id'],subquestion_id=qid,criterion_ids=[c['id'] for c in setobj['subquestions'][int(qid[-1])-1]['criteria']],relation=relation,reason=reason,original_question_ids=list(dict.fromkeys(x['original'] for x in originals)),frequency_kind='mock' if spec['topic'] in ['04','07'] else 'past_exam_adjacent',reprint_treatment='같은 원출제의 교재 재수록은 별도 빈도로 더하지 않는다. 해당 요소의 직접 범위와 신규 심화 범위를 구별한다.',source_locations=originals,source_hashes={i:units[i]['contentHash'] for i in sourceids},review_status='needs_review',target=dict(scope='draft',file=(D/'a/sets.json').relative_to(ROOT).as_posix(),set_id=spec['id'],subquestion_id=qid,criterion_ids=[c['id'] for c in setobj['subquestions'][int(qid[-1])-1]['criteria']])) )

coverage[1]['original_question_ids']=['mock:2025:GS1-3:2']
coverage[1]['adjacent_original_question_ids']=['cpa_exam:2025:3:3']
pending_file='cpa_uploader/drafts/frequency-gap-2026-09-10/draft-05-260-001.json'
pending=read(ROOT/pending_file)
design[-1]['compared_pending_drafts']=[dict(file=pending_file,file_sha256=sha(ROOT/pending_file),set_id=pending['id'],question_ids=[q['id'] for q in pending['subquestions']],actual_comparison='발문·모범답안·모든criterion을직접읽었다.260.16 유의적발견사항과17 독립성커뮤니케이션의12요소로 현pilot05-008과같은요구에가깝다.신규22/A51~53의적절성·영향·외부상위소유주조치와다르다.')]
for f in ['bank-before.json','catalog-before.json','classification-before.json','source-catalog-final.json']:

    used_files.add((D/f).relative_to(ROOT).as_posix())
sourcefiles=[dict(file=f,sha256=sha(ROOT/f),role=('source_catalog_snapshot' if f.endswith('source-catalog-final.json') else 'comparison_snapshot' if f.startswith(D.relative_to(ROOT).as_posix()) else 'analysis_discovery_index' if '/question-elements/' in f else 'comparison_draft' if f.endswith('draft-05-260-001.json') else 'source_text'),read_method='실제 원문·카탈로그 구조·비교문항 내용 읽기. 원PDF 시각대조는 root의 별도 등록기록에 결속.') for f in sorted(used_files)]
write('sets.json',sets);write('design.json',design);write('review.json',review);write('qa.json',qa);write('coverage-proposals.json',coverage);write('source-files.json',sourcefiles)
print(json.dumps(dict(sets=len(sets),questions=sum(len(s['subquestions']) for s in sets),facts_chars=[len('\n'.join(f['text'] for f in s['shared_context']['facts'])) for s in sets],points=[sum(c['max_points'] for q in s['subquestions'] for c in q['criteria']) for s in sets],qa=len(qa),sha256={f:sha(A/f) for f in ['sets.json','design.json','review.json','qa.json']}),ensure_ascii=False,indent=2))
