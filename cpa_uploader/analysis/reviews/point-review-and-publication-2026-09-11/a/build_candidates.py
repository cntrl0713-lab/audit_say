"""Local, deterministic assembly of manually reviewed candidates; never calls a model."""
import copy, hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
OUT = Path(__file__).resolve().parent
BATCH = OUT.parent
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(b): return hashlib.sha256(b).hexdigest()
def save(name, d): (OUT/name).write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
original = read(BATCH/'canonical-before.json')
sets = copy.deepcopy([s for s in original if s['classification']['topic_id'] in ['01','02','03','04','05','06']])
source_hash = sha((BATCH/'canonical-before.json').read_bytes())
classification = {(e['set_id'], e['subquestion_id']): e for e in read(ROOT/'cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/canonical-classification.json')['entries']}
S = {s['id']: s for s in sets}
Q = {(s['id'],q['id']): q for s in sets for q in s['subquestions']}
O = {(s['id'],q['id']): q for s in original for q in s['subquestions']}
changes, atoms, mappings, prompt_notes = {}, {}, {}, {}
def key(short, sub): return ('pilot-'+short, 'sub'+str(sub))
def alter(short, sub, reason, specs=None, prompt=None, answer=None):
    k=key(short,sub); q=Q[k]; changes[k]=reason
    if prompt is not None: prompt_notes[k]={'before':q['prompt'],'after':prompt,'reason':reason}; q['prompt']=prompt
    if specs:
        old={c['id']:c for c in q['criteria']}; result=[]; aa={}; mm=[]
        for cid, parent, text, typ in specs:
            c=copy.deepcopy(old[parent]); c['id']=cid; c['claim']=text
            c['critical_facts']=[{'id':'cf-'+cid,'type':typ,'expected':text}]
            c['max_points']=1; c['scores']={'met':1,'not_met':0,'contradicted':0}
            result.append(c); aa[cid]=text; mm.append({'before_criterion_ids':[parent], 'after_criterion_id':cid, 'relation':'retained' if cid==parent and c==old[parent] else 'revised_or_split','answer_proposition':text})
        q['criteria']=result; atoms[k]=aa; mappings[k]=mm
    if answer is not None: q['model_answer']=answer

# The argument following each new ID is its historical parent criterion; IDs are never renumbered.
alter('01-002',2,'정보의 입수와 입수정보를 이용한 위협 상황·관계의 식별·평가는 서로 독립된 절차이다. 안전장치/조건부 해지의 대안 관계와 미해결 보고는 유지한다.',[
 ('crit4','crit4','회계법인과 해당되는 경우 네트워크 회계법인에서 독립성 관련 정보를 입수한다.','action'),
 ('crit9','crit4','독립성에 위협을 일으키는 상황과 관계를 식별하고 평가한다.','action'),
 ('crit5','crit5','독립성 정책·절차 위반정보를 평가하여 감사업무의 독립성 위협 발생 여부를 결정한다.','action'),
 ('crit6','crit6','안전장치를 적용하여 위협을 제거하거나 수용가능한 수준으로 감소시킨다.','action'),
 ('crit7','crit7','또는 적합하다고 고려되며 법규상 가능한 경우 감사업무 해지를 위한 조치를 취한다.','action'),
 ('crit8','crit8','적합한 조치로 해결할 수 없으면 회계법인에 신속히 보고한다.','action')],answer=['회계법인 및 해당되는 경우 네트워크 회계법인으로부터 관련 정보를 입수하고, 독립성 위협을 일으키는 상황과 관계를 식별·평가한다.','정책·절차 위반정보를 평가하여 감사업무의 독립성에 위협이 발생하는지 결정한다.','안전장치를 적용하여 위협을 제거하거나 수용가능한 수준으로 감소시키는 조치를 취한다. 또는 적합하며 법규상 가능하면 감사업무 해지 조치를 취한다. 적합한 조치로 해결할 수 없으면 회계법인에 신속히 보고한다.'])
alter('01-004',1,'기존 crit2가 목적과 시급성을 결합해 목적만 또는 신속성만 맞힌 답을 0점 처리한다. 두 독립 요구를 분리하고 기존 요구를 발문에 명료화한다. 커뮤니케이션 의무와 독자처리 불가는 같은 의무의 긍정·부정이므로 crit1 한 번만 채점한다.',[
 ('crit1','crit1','해당 정보를 회계법인에 커뮤니케이션해야 하므로 업무수행이사 자체 판단으로만 처리하는 것은 적절하지 않다.','conclusion'),
 ('crit2','crit2','정보 전달의 목적은 회계법인과 업무수행이사가 필요한 조치를 취할 수 있도록 하는 것이다.','conclusion'),
 ('crit5','crit2','해당 정보를 신속히 커뮤니케이션해야 한다.','condition')],prompt='조기에 알았더라면 회계법인이 감사업무를 거절하였을 정보를 업무수행이사가 입수하였다. 그 정보를 보유한 채 자체 판단으로만 처리하는 것이 적절한지 판단하고, 기준서상 필요한 정보 전달의 목적과 시급성을 설명하시오.')
alter('01-004',2,'기존 인용이 220.14(b)만 보유해 첫 번째 능력을 지지하지 않는다. 14 본문과 (a)(b)를 직접 연결하고 총체적 능력이라는 전제를 명료화한다. 두 수행능력은 각 1점으로 유지한다.',prompt='업무수행이사가 업무팀 및 업무팀원이 아닌 감사인측 전문가들이 총체적으로 적합한 적격성과 역량을 갖추었는지 확인해야 하는 두 가지 수행능력을 제시하시오.')
alter('02-001',1,'원발문의 일반적인 근거 요구를 한 개의 병렬 금지 명제로만 채점하던 불일치를 해소한다. 기존 모범답안의 두 판단을 명시적으로 묻고 1점씩 유지한다.',prompt='감사인이 경영진의 정직성과 성실성을 신뢰하는 경우, 전문가적 의구심 유지의 필요성이 경감되는지와 설득력이 낮은 감사증거에 만족해도 되는지를 각각 판단하시오.')
alter('02-004',2,'역관계에는 주어진 감사위험 수준이라는 전제가 필요하다. 기존 모범답안·claim 및 선행 수정결정의 고유한계 이유를 발문에 명시하고 판단과 독립 이유를 분리한다. 이유가 제거 불가를 분명히 함축하면 판단도 인정한다.',[
 ('crit3','crit3','주어진 감사위험 수준에서 수용가능한 적발위험은 평가된 중요왜곡표시위험과 역의 관계이다.','conclusion'),
 ('crit4','crit4','적발위험을 완전히 제거할 수는 없다.','negation'),
 ('crit5','crit4','감사의 고유한계 때문에 어느 정도의 미발견 위험이 항상 남는다.','conclusion')],prompt='주어진 감사위험 수준에서, 경영진주장 수준의 평가된 중요왜곡표시위험과 수용가능한 적발위험의 관계를 설명하시오. 적발위험을 완전히 제거할 수 있는지 판단하고 그 이유도 설명하시오.',answer=['주어진 감사위험 수준에서 수용가능한 적발위험은 평가된 중요왜곡표시위험과 역의 관계이다.','적발위험은 완전히 제거할 수 없다. 감사의 고유한계 때문에 어느 정도의 미발견 위험은 항상 존재한다.'])
alter('02-005',1,'정의와 두 구성 위험을 연결하는 관계를 묻는다. 중요왜곡표시위험과 적발위험 중 하나만 올바르게 연결한 답에도 부분점수를 주도록 두 관계 대상을 분리한다. 함수라는 단어에 별도 점수를 주지 않는다.',[
 ('crit1','crit1','감사위험은 중요하게 왜곡표시된 재무제표에 대해 감사인이 부적합한 감사의견을 표명할 위험이다.','conclusion'),
 ('crit2','crit2','감사위험은 중요왜곡표시위험의 영향을 받는 함수이다.','conclusion'),
 ('crit4','crit2','감사위험은 적발위험의 영향을 받는 함수이다.','conclusion')])
alter('02-005',2,'발문·모범답안에는 적발위험의 제거 가능성 판단이 있지만 채점 기준이 누락되어 있다. 정의 1점과 제거 불가 판단 1점을 복원하고 잘못 연결된 감사위험 정의 대신 200.13(e)·A49를 직접 연결한다.',[
 ('crit3','crit3','적발위험은 감사위험을 낮추려고 수행한 감사절차가 개별적으로 또는 합산하면 중요할 수 있는 왜곡표시를 발견하지 못할 위험이다.','conclusion'),
 ('crit5','crit3','적발위험은 감소시킬 수 있지만 완전히 제거할 수는 없다.','negation')],prompt='적발위험의 정의를 서술하고, 적발위험을 완전히 제거할 수 있는지 판단하시오.')
alter('03-001',2,'판단 결론을 묻지 않고 두 고려사항을 기술하도록 하므로 답안 형식을 descriptive로 바로잡는다. 정당성과 범위제한 시사점의 2점은 유지한다.')
Q[key('03-001',2)]['type']='descriptive'
alter('03-002',1,'의견거절 예상은 발문에 주어진 사실이므로 이를 복사한 데 1점을 주지 않는다. 실제 요구인 수임 금지 판단과 법규상 예외를 각각 1점으로 대체한다.',[
 ('crit1','crit1','수임 금지의 예외는 법규에 의해 수임이 요구되는 경우이다.','condition'),
 ('crit2','crit2','그와 같이 제한된 감사업무를 수임해서는 안 된다.','conclusion')])
alter('03-004',1,'두 절차의 2점은 유지한다. 책임 동의를 뒷받침할 210.6(b)의 하위 책임까지 실제 근거에 연결하되 세부 책임 목록을 발문 밖의 새 득점 요건으로 넣지 않는다.')
alter('03-004',2,'기존에 주어진 법규 예외를 되풀이하여 득점시키지 않도록 예외를 답해야 할 대상으로 옮겨 명시한다. 원래 모범답안·criterion의 금지사유 2개와 법규 예외 1개를 유지하며 210.8(a)(b) 및 19 의존 문맥을 보강한다.',prompt='감사를 위한 전제조건이 존재하지 않아 감사인이 경영진과 논의하였다. 감사기준서 210 문단 8에 따라 제안된 감사업무를 수임해서는 안 되는 두 가지 경우를 제시하시오. 수용가능하지 않은 재무보고체계에 관한 문단 19의 예외는 제외하고 답하되, 법규에 의해 감사가 요구되는 경우의 취급도 설명하시오.')
alter('04-001',2,'수행중요성 수정 여부와 추가절차 성격·시기·범위의 재평가는 서로 다른 결정 대상이다. 세 절차 특성 중 일부만 맞힌 답을 복원하여 2→4점으로 조정한다. 중요성 인하 자체는 주어진 사실로 미득점이다.',[
 ('crit3','crit3','수행중요성을 수정할 필요가 있는지 결정한다.','action'),
 ('crit4','crit4','추가감사절차의 성격이 여전히 적합한지 결정한다.','action'),
 ('crit5','crit4','추가감사절차의 시기가 여전히 적합한지 결정한다.','action'),
 ('crit6','crit4','추가감사절차의 범위가 여전히 적합한지 결정한다.','action')])
alter('04-002',2,'전략·계획 자체와 중요한 변경의 내용·이유는 네 독립 기록 대상이다. 변경만 기록한 답에서 전략·계획 자체의 점수를 주지 않는 기존 경계를 보존한다.',[
 ('crit4','crit4','전반감사전략 자체를 문서화한다.','action'),
 ('crit5','crit5','감사계획 자체를 문서화한다.','action'),
 ('crit6','crit6','감사 진행 중 발생한 전반감사전략 또는 감사계획의 중요한 변경내용을 문서화한다.','action'),
 ('crit7','crit6','전반감사전략 또는 감사계획의 중요한 변경 이유를 문서화한다.','action')])
alter('04-004',2,'230.8의 세 상위 항목에 여덟 개 독립 기록내용이 포함된다. 절차의 성격·시기·범위, 수행결과·증거, 유의사항·결론·전문가적 판단을 각각 1점으로 분리한다. 항목 수 3은 상위 구분이며 점수 상한이 아니다. 같은 문서화 목표의 목록이므로 물음 분할은 하지 않는다.',[
 ('crit2','crit2','수행한 감사절차의 성격을 문서화한다.','action'),
 ('crit5','crit2','수행한 감사절차의 시기를 문서화한다.','action'),
 ('crit6','crit2','수행한 감사절차의 범위를 문서화한다.','action'),
 ('crit3','crit3','감사절차의 수행결과를 문서화한다.','action'),
 ('crit7','crit3','입수한 감사증거를 문서화한다.','action'),
 ('crit4','crit4','감사 중 발생한 유의적 사항을 문서화한다.','action'),
 ('crit8','crit4','유의적 사항에 대해 도달한 결론을 문서화한다.','action'),
 ('crit9','crit4','결론에 도달할 때 행한 유의적인 전문가적 판단을 문서화한다.','action')])
alter('04-005',2,'네 금액·수정 항목만 맞힌 답에도 4점을 주고 금액 결정 시 고려요소의 문서화는 공통 독립 요구 1점으로 분리한다. 같은 공통 의무를 금액마다 반복하여 4점 추가하지 않는다. 해당되는 경우라는 적용 조건은 특정 중요성 수준 명제의 정확성 요건으로 보존한다.',[
 ('crit3','crit3','재무제표 전체에 대한 중요성 금액을 문서화한다.','action'),
 ('crit4','crit4','해당되는 경우 특정 거래유형·계정잔액·공시의 중요성 수준을 문서화한다.','action'),
 ('crit5','crit5','수행중요성 금액을 문서화한다.','action'),
 ('crit6','crit6','감사 진행에 따른 위 중요성 금액들의 수정내용을 문서화한다.','action'),
 ('crit7','crit3','각 중요성 금액과 수정된 금액을 결정할 때 고려한 요소들을 함께 문서화한다.','action')])
alter('05-001',1,'언제 커뮤니케이션하는지와 논의할 세 절차 특성이 실제 요구이다. 전달 상대방·법규 예외는 이미 제시된 조건이므로 별도 가점하지 않고, 논의 성격·시기·범위의 독립 부분정답을 복원한다.',[
 ('crit1','crit1','경영진 연루 부정의 의심을 지배기구에 적시에 커뮤니케이션한다.','action'),
 ('crit2','crit2','감사 완료에 필요한 감사절차의 성격을 지배기구와 논의한다.','action'),
 ('crit3','crit2','감사 완료에 필요한 감사절차의 시기를 지배기구와 논의한다.','action'),
 ('crit4','crit2','감사 완료에 필요한 감사절차의 범위를 지배기구와 논의한다.','action')])
alter('05-002',2,'편의가 있는지 검토하는 절차와 그 편의 환경이 부정 중요왜곡표시위험을 나타내는지 평가하는 절차를 분리한다. 개별 판단이 합리적이어도 후자의 평가를 생략할 수 없다는 조건은 그 평가에 남기고 별도 어구 점수로 만들지 않는다.',[
 ('crit4','crit4','회계추정치에 경영진의 편의가 있는지 검토한다.','action'),
 ('crit7','crit4','개별 판단·결정이 합리적이어도 편의 가능성과 이를 유발하는 환경이 부정 중요왜곡표시위험을 나타내는지 평가한다.','action'),
 ('crit5','crit5','그러한 편의 가능성이 나타나면 회계추정치를 전반적으로 다시 평가한다.','action'),
 ('crit6','crit6','전기재무제표의 유의적 회계추정치 관련 경영진 판단·가정을 소급 재검토한다.','action')])
alter('05-003',2,'내부통제 효과성에 대한 의견표명이 목적이 아님과 통제를 고려하는 적극적인 목적은 서로 다른 설명이다. 한쪽만 맞힌 점수를 복원한다. 보고대상 미비점의 식별·중요성 조건은 대상의 정확한 범위를 이루므로 단어별로 분해하지 않는다.',[
 ('crit4','crit4','미비점의 내역을 제시한다.','action'),
 ('crit5','crit5','미비점의 잠재적 영향을 설명한다.','action'),
 ('crit6','crit6','감사의 목적은 재무제표에 대한 의견 표명이라고 설명한다.','conclusion'),
 ('crit7','crit7','내부통제 효과성에 대한 의견 표명은 해당 감사의 목적이 아니라고 설명한다.','negation'),
 ('crit9','crit7','상황에 적합한 감사절차를 설계하기 위하여 재무제표 작성 관련 내부통제를 고려한다고 설명한다.','conclusion'),
 ('crit8','crit8','보고사항은 감사 중 식별되어 지배기구 보고에 충분히 중요하다고 결정한 미비점으로 제한된다고 설명한다.','condition')])
alter('05-005',2,'발문이 명시적으로 요구한 통제 식별·설계 평가·실행 여부 결정의 세 활동을 1점에 묶은 결함을 수정한다. 유의적 위험 취급 1점을 포함해 4점이며 운영효과성 테스트와 구별한다.',[
 ('crit3','crit3','평가된 부정 중요왜곡표시위험을 유의적 위험으로 취급한다.','conclusion'),
 ('crit4','crit4','아직 수행하지 않은 부분이 있으면 해당 위험에 대처하는 통제를 식별한다.','action'),
 ('crit5','crit4','아직 수행하지 않은 부분이 있으면 해당 통제의 설계를 평가한다.','action'),
 ('crit6','crit4','아직 수행하지 않은 부분이 있으면 해당 통제가 실행되었는지 결정한다.','action')])
alter('05-006',2,'거래의 사업상 논리적 근거에 비추어 검토하는 두 부정 목적은 별개의 평가 대상이다. 두 목적의 징후를 모두 요구하는 기존 답안에서 한 목적만 올바르게 평가한 답을 인정한다. 사업상 논리적 근거는 두 평가의 공통 필수 관점으로 별도 중복 가점하지 않는다.',[
 ('crit2','crit2','거래의 형식적 적법성 확인만으로는 충분하지 않다.','negation'),
 ('crit3','crit3','사업상 논리적 근거 또는 그 결여에 비추어 거래가 부정한 재무보고를 수행하기 위해 체결되었음을 나타내는지 평가한다.','action'),
 ('crit4','crit3','사업상 논리적 근거 또는 그 결여에 비추어 거래가 자산횡령을 은폐하기 위해 체결되었음을 나타내는지 평가한다.','action')])
alter('05-007',1,'일반적인 전문가·법률상 책임 결정과 발문이 별도로 포함하라고 한 외부 보고 요구사항의 확인, 법규상 가능한 해지의 적절성 고려를 구분한다. 전문가/법률이라는 규범 근거 명칭을 따로 점수화하지 않는다.',[
 ('crit1','crit1','해당 상황에 맞는 전문가로서의 책임과 법률적 책임을 결정한다.','action'),
 ('crit5','crit1','감사인을 선임한 당사자 또는 경우에 따라 규제기관에 보고할 요구사항이 존재하는지 결정한다.','action'),
 ('crit2','crit2','관련 법규상 감사업무의 해지가 가능하면 해당 업무를 해지하는 것이 적절한지 고려한다.','action')])
alter('05-007',2,'발문이 토의·보고의 대상·내용 및 보고 요구사항 결정을 명시적으로 요구한다. 토의의 경영진·지배기구/해지 사실·이유와 보고의 대상/내용/요구 여부를 분리한다. 보고 대상의 선임 당사자 또는 해당 규제기관은 조건부 하나의 대상 범주이고, 두 보고 내용은 공통 1점 범주로 결합하지 않는다. 요구 증가 없이 기존 부분정답을 복원하며 상위 두 절차라는 수와 점수를 구별한다.',[
 ('crit3','crit3','적합한 수준의 경영진과 토의한다.','actor'),
 ('crit5','crit3','지배기구와 토의한다.','actor'),
 ('crit6','crit3','토의할 내용은 감사업무를 해지한다는 사실이다.','conclusion'),
 ('crit7','crit3','토의할 내용에 감사업무를 해지하는 이유가 포함된다.','conclusion'),
 ('crit4','crit4','해지에 관한 외부 보고의 전문가로서의 요구사항이나 법률적인 요구사항이 존재하는지 결정한다.','action'),
 ('crit8','crit4','보고 요구사항의 상대방은 감사인을 선임한 당사자 또는 경우에 따라 규제기관이다.','actor'),
 ('crit9','crit4','보고 요구사항에서 다루는 내용은 감사업무 해지 사실이다.','conclusion'),
 ('crit10','crit4','보고 요구사항에서 다루는 내용에는 감사업무 해지 이유도 포함된다.','conclusion')],prompt=classification[key('05-007',2)]['standalone_prompt'])
alter('06-001',1,'위험평가절차의 두 대상 수준과 중요왜곡표시위험 식별·평가 목적을 분리한다. 부정/오류는 위험의 원인 범위를 이루므로 이를 별도 단어 점수로 세지 않는다.',[
 ('crit1','crit1','위험평가절차의 대상에는 재무제표 수준의 부정이나 오류로 인한 위험이 포함된다.','condition'),
 ('crit5','crit1','위험평가절차의 대상에는 경영진주장 수준의 부정이나 오류로 인한 위험이 포함된다.','condition'),
 ('crit2','crit2','중요왜곡표시위험을 식별하고 평가하기 위하여 수행하는 감사절차이다.','action')])
alter('06-002',1,'관찰과 검사는 서로 다른 감사절차로서 한쪽만 제시한 답도 독립적으로 맞다. 기준서의 세 상위 범주를 네 절차 요소로 채점한다. 질문의 적절한 대상 조건은 유지한다.',[
 ('crit1','crit1','경영진과 기업 내부의 기타 적절한 관련자에게 질문한다. 내부감사기능이 있으면 그 기능 내 담당자를 포함한다.','action'),
 ('crit2','crit2','분석적절차를 수행한다.','action'),
 ('crit3','crit3','관찰을 수행한다.','action'),
 ('crit9','crit3','검사를 수행한다.','action')])
alter('06-003',2,'IT 응용프로그램과 기타 IT 환경은 별도 식별 대상이다. 나머지 관련 위험·일반통제·설계·실행은 기존 독립 절차를 유지한다. 실행 확인의 질문에 추가된 절차는 정확한 방법 조건이므로 질문만 제시한 답에 별도 점수를 만들지 않는다.',[
 ('crit7','crit7','식별된 통제를 바탕으로 IT 사용 위험이 따르는 IT 응용프로그램을 식별한다.','action'),
 ('crit12','crit7','식별된 통제를 바탕으로 IT 사용 위험이 따르는 IT 환경의 기타 측면을 식별한다.','action'),
 ('crit8','crit8','식별된 IT 응용프로그램과 환경의 IT 사용 관련 위험을 식별한다.','action'),
 ('crit9','crit9','그러한 IT 사용 위험에 대처하는 IT 일반통제를 식별한다.','action'),
 ('crit10','crit10','식별한 통제와 IT 일반통제가 중요왜곡표시위험에 대처하거나 다른 통제의 운영을 지원하기에 효과적으로 설계되었는지 평가한다.','action'),
 ('crit11','crit11','기업 인원에 대한 질문에 추가된 절차로 식별한 통제의 실행 여부를 결정한다.','action')])
alter('06-005',1,'발문이 두 영향의 방법과 정도를 모두 요구한다. 영향을 미치는 경로와 크기는 한쪽만 설명해도 독립적으로 의미가 성립하므로 각각 1점으로 분리하며 영향 요인의 명칭만 적은 답에 점수를 주지 않는다.',[
 ('crit1','crit1','고유위험요소가 관련경영진주장의 왜곡표시 가능성에 영향을 미치는 방법을 고려한다.','action'),
 ('crit5','crit1','고유위험요소가 관련경영진주장의 왜곡표시 가능성에 영향을 미치는 정도를 고려한다.','action'),
 ('crit2','crit2','재무제표 수준 중요왜곡표시위험이 경영진주장 수준의 고유위험 평가에 영향을 미치는 방법을 고려한다.','action'),
 ('crit6','crit2','재무제표 수준 중요왜곡표시위험이 경영진주장 수준의 고유위험 평가에 영향을 미치는 정도를 고려한다.','action')])
alter('06-005',2,'통제 테스트가 유일한 증거 수단일 수 있다는 원인과 추가감사절차 설계·수행에 미치는 시사점은 두 설명이다. 후속 통제테스트 의무 1점은 유지하고 의미 없는 문단 상호참조 src4 대신 완전한 330.8(b) 근거를 보강한다.',[
 ('crit3','crit3','위험·통제활동의 성격상 통제 운영효과성 테스트만이 충분하고 적합한 증거를 얻는 유일한 방법일 수 있다.','conclusion'),
 ('crit5','crit3','그 위험의 식별 여부가 추가감사절차의 설계와 수행에 영향을 미치기 때문이다.','conclusion'),
 ('crit4','crit4','그 위험에 대처하는 통제의 운영효과성에 관한 증거를 얻도록 통제테스트를 설계하고 수행해야 한다.','action')])

# Exact additional source excerpts. Original refs remain as historical inputs; requirements are rebound below.
raw_path=ROOT/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt'
raw=raw_path.read_text(encoding='utf-8')
pages={int(n): t for n,t in re.findall(r'## PDF page (\d+)\n(.*?)(?=## PDF page |\Z)',raw,re.S)}
def between(text,start,end): return text[text.index(start):text.index(end,text.index(start))].rstrip()
extras={
 '220-14':('220','57',between(pages[57],'14. \n','감사업무의 수행')),
 '200-13e':('200','8',between(pages[8],'(e) \n적발위험','(f) \n재무제표')),
 '200-A47':('200','22',between(pages[22],'A47.','A48.')),
 '200-A49':('200','22–23',between(raw,'A49. 감사기준서 30021','감사의 고유한계 \nA50.')),
 '210-6':('210','34',between(pages[34],'6. \n','감사업무 수임 전의 범위제한')),
 '210-8':('210','34',pages[34][pages[34].index('8. \n'):].rstrip()),
 '210-19':('210','36–37',between(raw[raw.index('## PDF page 36'):],'19. \n','20. \n')),
}
# 330.8 appears in the already preserved official text; keep its exact spelling and conditions.
review06=ROOT/'cpa_uploader/data/official/kga315-330-2025-review06.txt'
t06=review06.read_text(encoding='utf-8')
m=re.search(r'(?m)^8\.\s',t06[t06.index('KGA 330'):])
if m:
 sec=t06[t06.index('KGA 330'):]; start=m.start(); end=re.search(r'(?m)^9\.\s',sec[start:])
 extras['330-8']=('330','문단 8',sec[start:start+end.start()].rstrip())
else: raise RuntimeError('330.8 exact excerpt not located')
evidence='# 공식 추가 발췌 — 기존 문항 배점 검토 A\n\n원전: 회계감사기준 전문(2025년 11월 개정). 보고기간: 2026-01-01 개시, 2027 CPA 대비 기존 판본 정책.\n원전 추출 파일: '+raw_path.relative_to(ROOT).as_posix()+'\n원전 추출 SHA256: '+sha(raw_path.read_bytes())+'\n공식 원문 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06\n\n'
for eid,(std,page,quote) in extras.items(): evidence+=f'## KGA {std}: {eid} / PDF {page}\n\n{quote}\n\n'
(OUT/'source-evidence.txt').write_text(evidence,encoding='utf-8')
source_updates=[]
def bind(short,sub,eid,cids):
    k=key(short,sub); s=S[k[0]]; q=Q[k]; std,page,quote=extras[eid]; sid='src-point-a-'+eid.lower(); rid='req-point-a-'+eid.lower()
    if not any(r['id']==sid for r in s['source_refs']):
        s['source_refs'].append({'id':sid,'file':(OUT/'source-evidence.txt').relative_to(ROOT).as_posix(),'title':f'공식 2025 전문 KGA {std} {eid.split("-",1)[1]}, PDF {page}','page':'KGA '+std,'source_quote':quote,'role':'standard','content_hash':sha(quote.encode())})
    if not any(r['id']==rid for r in q['requirements']):q['requirements'].append({'id':rid,'source_ref_id':sid,'source_quote':quote,'source_span':f'2025 전문 KGA {std}, {eid}, PDF {page}; source-evidence.txt exact excerpt'})
    for c in q['criteria']:
        if c['id'] in cids:c['requirement_id']=rid;c['source_ref_ids']=[sid]
    source_updates.append({'set_id':k[0],'subquestion_id':k[1],'criterion_ids':cids,'new_source_ref_id':sid,'official_paragraph':eid,'page':page,'quote_sha256':sha(quote.encode()),'original_refs_preserved':True})
bind('01-004',2,'220-14',['crit3','crit4'])
bind('02-004',2,'200-A47',['crit3']);bind('02-004',2,'200-A49',['crit4','crit5'])
bind('02-005',2,'200-13e',['crit3']);bind('02-005',2,'200-A49',['crit5'])
bind('03-004',1,'210-6',['crit1','crit2']);bind('03-004',2,'210-8',['crit3','crit4','crit5'])
bind('03-004',2,'210-19',[])
bind('06-005',2,'330-8',['crit4'])

# Carry forward material acceptance/rejection boundaries into the actual grading input.
guards={
 ('01-004',1,'crit1'):'회계법인에 해당 정보를 커뮤니케이션해야 한다는 조치가 분명하면 독자 처리 불가 판단을 함축하므로 인정한다. 명시적으로 자체 판단만으로 처리해도 된다고 하면 이 판단은 인정하지 않는다.',
 ('04-002',2,'crit4'):'중요한 변경내용만 기록한다고 한 답에서 변경 대상 명칭에 전반감사전략이 등장한다는 이유로 전략 자체의 문서화 점수를 주지 않는다.',
 ('04-002',2,'crit5'):'중요한 변경내용만 기록한다고 한 답에서 변경 대상 명칭에 감사계획이 등장한다는 이유로 계획 자체의 문서화 점수를 주지 않는다.',
 ('05-005',2,'crit5'):'설계 평가를 운영효과성 테스트로 대체한다는 답은 이 요구를 충족하지 않는다.',
 ('05-006',2,'crit2'):'필요한 추가 평가를 분명히 제시하여 형식적 적법성 확인만으로 불충분함을 함축해도 인정하되, 명시적 반대 결론은 인정하지 않는다.'}
for (short,sub,cid),note in guards.items():
 c=next(c for c in Q[key(short,sub)]['criteria'] if c['id']==cid)
 c['claim']+=' '+note;c['critical_facts'][0]['expected']+=' '+note

# Explicit decisions for every unchanged question; avoid automatic 'all old 1-point criteria are good'.
keep={
 '01-001/1':'정의의 객관적 평가 내용, 평가시점, 두 적용대상은 이미 네 독립 명제로 분리되어 있다. 유의적 판단/결론을 단어별로 추가 분해하지 않는다.',
 '01-001/2':'책임 경감 여부만 묻는 단일 판단으로 1점이 적절하다. 묻지 않은 검토자 자격이나 이유를 더하지 않는다.',
 '01-002/1':'전 과정의 주의 유지, 위반 징후 후 자문, 적합한 조치 결정이 이미 세 독립 단계이다. 관찰과 질문은 전 과정 주의 유지의 방법 조건으로 유지한다.',
 '01-003/1':'네 상위 사항 안에서 자문 성격·범위·결론의 일치 확인은 별개 확인 대상이다. 기존 6점은 상위 항목 수가 아닌 독립 명제를 반영한다.',
 '01-003/2':'의견 차이 처리·해결 정책과 절차를 따른다는 하나의 처리 원칙만 요구하므로 1점을 유지한다.',
 '02-001/2':'전문가적 판단의 정의 1점과 명시적으로 요구한 세 기준 명칭 3점이 이미 분리되어 있다. 훈련·지식·경험은 정의의 자원 설명으로 별도 열거를 요구하지 않는다.',
 '02-002/1':'예외적 이탈 조건과 대체 감사절차의 수행이 1점씩이다. 목적 달성은 대체절차의 필수 조건으로 묶되 별도 문서화 요구를 추가하지 않는다.',
 '02-002/2':'의견변형 평가, 법규상 가능한 해지 평가, 유의적 사항 문서화의 세 의무가 분리되어 있다. 자동 해지와 구별한다.',
 '02-003/1':'의견의 대상과 인증하지 않는 두 범주가 1점씩이다. 중요성 관점·재무보고체계는 의견 대상 명제의 정확성을 구성한다.',
 '02-003/2':'관련성의 두 필요조건과 준수 표명의 요건이 독립적인 3점이다. 조건의 AND 관계는 전체 답안에서 보존한다.',
 '02-004/1':'충분성의 양적 척도와 적합성의 질적 척도를 명시적으로 각 1점으로 묻는다. 목적적합성·신뢰성 설명을 숨은 요구로 추가하지 않는다.',
 '03-001/1':'경영진 책임의 세 범주와 불인정 시 법규 예외를 가진 수임 판단으로 4점이 적절하다. 정보 접근의 세 세부 경로까지 새 요구로 확대하지 않는다.',
 '03-002/2':'조건 수정 필요성과 기존 조건 재고지 필요성은 이미 독립 2점이다. 계속감사 상황의 단순 반복은 득점하지 않는다.',
 '03-003/1':'법규 적용 사실과 책임 인정/이해는 서로 다른 기록 사실이다. 두 상위 항목 속 세 명제라는 선행 검토를 유지한다.',
 '03-003/2':'새 조건 합의와 합의서 기록은 독립 2점이다. 한 문장으로 둘 다 작성해도 각각 인정한다.',
 '04-001/1':'순차적 수립 불필요 판단과 상호 변경 영향이라는 독립 이유가 이미 1점씩이며 총 2점이다.',
 '04-002/1':'계속 여부 절차, 윤리 준수 평가, 업무조건 이해라는 세 활동을 각 1점으로 유지한다. 기준서 번호 자체에 별도 점수 없음.',
 '04-003/1':'자원의 성격·시기·범위를 명시적으로 세 측면으로 물어 이미 1점씩 분리되어 있다.',
 '04-003/2':'세 절차 범주만 묻는다. 성격·시기·범위나 기준서 번호를 추가 채점하지 않는 기존 3점이 적절하다.',
 '04-004/1':'언제 작성하는지만 묻는 단답으로 적시 작성 1점이다. 적시 작성의 이유는 발문 밖이다.',
 '04-005/1':'저장공간 사유의 삭제 불가 판단과 어떠한 성격의 문서도 대상이라는 독립 범위 근거가 1점씩이다. 사실 적용을 요구하므로 case를 유지한다.',
 '05-001/2':'법적 조언의 고려 가능성이라는 단일 조치 1점이다. 모든 상황의 의무로 바꾸면 맞는 답이 아니다.',
 '05-002/1':'질문, 기간말 추출, 기간 전체 테스트 필요성 고려의 세 독립 절차가 분리되어 있다. 기간말/전체의 차이는 각 절차의 의미조건이다.',
 '05-003/1':'상대방·시점·형태를 명시적으로 물으며 지배기구·적시·서면의 3점이 이미 분리되어 있다.',
 '05-004/1':'행위 성격, 발생 상황, 영향 평가용 추가 정보는 세 독립 요구이다. 두 상위 절차 안의 부분점수가 이미 지원된다.',
 '05-004/2':'외부 보고 의무 여부와 확립된 책임에 따른 상황 적합성이라는 두 다른 결정으로 2점이다. 무조건 보고 의무는 요구하지 않는다.',
 '05-005/1':'부정위험 무추정 불허 판단과 유형별 위험 평가 접근이 1점씩이다. 추정 배제 이유의 문서화는 보충 해설이며 이번 발문 밖의 가점으로 삼지 않는다.',
 '05-006/1':'전기 유의적 추정치 관련 판단·가정을 소급 재검토하는 한 절차를 묻는다. 판단/가정은 그 절차의 공통 검토대상이며 별도 항목 열거 요구가 없다.',
 '06-001/2':'전반적 영향이라는 판단과 통제환경이 다른 구성요소의 기초라는 충분한 근거가 1점씩이다. 모범답안의 통제 효과성 부연을 필수 추가 점수로 올리지 않는다.',
 '06-002/2':'두 정보특성, 두 토의주제, 책임자라는 명시적 다섯 요구가 이미 분리되어 있다. 하나의 위험평가 준비 단계 비교 범위이므로 유지한다.',
 '06-003/1':'사업위험 식별·발생가능성을 포함한 유의성 평가·대응이라는 기업 절차 3개가 분리되어 있다. 감사인이 직접 기업 위험을 관리한다는 답과 구별한다.',
 '06-004/1':'유의적 위험과 실증절차만으로 증거 불충분한 위험이라는 두 범주로 2점이다.',
 '06-004/2':'왜곡표시 발생가능성과 규모를 명시적으로 두 측면으로 물어 각 1점이 적절하다.'}

# Questions changed only in wording/source still receive a fresh QA contract.
for k in changes:
    if k not in atoms: atoms[k]={c['id']:c['critical_facts'][0]['expected'] for c in Q[k]['criteria']}
    if k not in mappings:mappings[k]=[{'before_criterion_ids':[c['id']],'after_criterion_id':c['id'],'relation':'same_points_content_or_source_followup','answer_proposition':c['claim']} for c in Q[k]['criteria']]

entries=[]
for s in sets:
    set_changed=any((s['id'],q['id']) in changes for q in s['subquestions'])
    if set_changed:
        s['status']='needs_review';s['verification']['review_status']='needs_human_review'
        s['verification']['notes'].append('2026-09-11 기존 배점 후속 후보. 과거 검수 메모는 과거 판본 기록이며 이번 수정은 로컬 검토·형상 확인 단계, 새 모델 의미검수·채점·사람 확인은 미실행이다.')
        if s['id'] in ['pilot-02-004','pilot-02-005']:s['verification']['source_fidelity']='reconstructed'
    for q in s['subquestions']:
        k=(s['id'],q['id']); old=O[k]; short=s['id'].removeprefix('pilot-')+'/'+q['id'].removeprefix('sub')
        if k not in changes: assert short in keep,short
        cl=classification[k]; before=sum(c['max_points'] for c in old['criteria']);after=sum(c['max_points'] for c in q['criteria'])
        if k in atoms:minimum=list(atoms[k].values())
        else:minimum=[c['critical_facts'][0]['expected'] for c in q['criteria']]
        entries.append({'set_id':s['id'],'subquestion_id':q['id'],'parent_topic_id':s['classification']['topic_id'],'question_style':cl['question_style'],'topic_ids':cl['topic_ids'],'classification_reason':cl['reason'],'classification_changed':False,'case_fact_ids':cl['case_fact_ids'],'standalone_prompt':q['prompt'] if cl['question_style']=='standard' and k in prompt_notes else cl.get('standalone_prompt'),'before_points':before,'after_points':after,'decision':'adjust' if k in changes else 'retain','changed':k in changes,'reason':changes.get(k,keep.get(short)),'minimum_sufficient_answer':minimum,'burden':{'independent_scoring_units':after,'answer_format':q['type'],'reasoning':'기준서 내용과 일반 조건의 재현' if cl['question_style']=='standard' else '저장공간 사유와 보존기간·문서 범위를 적용하는 판단','comparison':'명시적 특성·대상 목록은 04-003/sub1 및 05-003/sub1과 같은 요소별 1점; 단일 행위의 필수 조건은 따로 분해하지 않음'},'criterion_mapping':mappings.get(k,[{'before_criterion_ids':[c['id']],'after_criterion_id':c['id'],'relation':'unchanged','answer_proposition':c['claim']} for c in q['criteria']]),'prompt_change':prompt_notes.get(k),'source_ref_ids':sorted({r for c in q['criteria'] for r in c['source_ref_ids']}),'source_updates':[r for r in source_updates if (r['set_id'],r['subquestion_id'])==k],'split_review':{'recommended':False,'reason':'동일 문서화 목록의 여덟 독립 내용으로, 범주3/5점을 임의 상한으로 삼지 않음' if k==key('04-004',2) else '같은 해지 후 토의와 보고 절차에서 발문이 명시한 대상·내용·요구사항 여부를 복원함. 학습 부담이 크면 토의/보고 두 물음으로 나눌 수 있으나 이번 후보는 원 물음 ID와 범위를 유지함' if k==key('05-007',2) else '현재 물음의 목표와 요구 범위 안에서 독립 criterion으로 부분점수 제공'},'status':'local_review_candidate' if k in changes else 'reviewed_no_change','model_api_calls':0,'source_file_sha256':source_hash})

save('sets.json',sets)
save('audit.json',{'version':1,'reviewer':'plan_foundations','owner':'a','baseline_file':'canonical-before.json','baseline_sha256':source_hash,'exam_policy':'2027 CPA 대비 / 2026-01-01 개시 / 종전 품질관리 체계; 공통 edition-policy.md의 공식 확인과 한계 유지','source_updates':source_updates,'entries':entries,'counts':{'sets':len(sets),'questions':len(entries),'changed_questions':sum(e['changed'] for e in entries),'before_points':sum(e['before_points'] for e in entries),'after_points':sum(e['after_points'] for e in entries)}})
save('qa-atoms.json',{'version':1,'questions':[{'set_id':k[0],'subquestion_id':k[1],'atoms':aa} for k,aa in atoms.items()]})
print(json.dumps({'sets':len(sets),'questions':len(entries),'changed':len(changes),'points_before':sum(e['before_points'] for e in entries),'points_after':sum(e['after_points'] for e in entries)},ensure_ascii=False))
