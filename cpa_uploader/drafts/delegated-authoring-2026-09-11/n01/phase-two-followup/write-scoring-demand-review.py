import datetime
import hashlib
import json
import os
from pathlib import Path

root = Path.cwd()
out = Path(__file__).resolve().parent
manifest_file = root / 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
entries = [e for e in manifest['entries'] if e['package'] in {'N01','N06','S01','S05','S06'}]
sets = {e['plan_id']: json.loads((root/e['file']).read_text(encoding='utf-8')) for e in entries}
entry_by_id = {e['plan_id']:e for e in entries}
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def link(label,p): return '['+label+']('+Path(os.path.relpath(root/p,out)).as_posix()+')'

proposals = [
 ('T01-A','sub3','crit5','strong',3,
  '발문은 낮은 보수 자체의 윤리적 의미, 위협 발생 조건, 발생 위협을 각각 요구한다. 현재 1점은 세 요구를 모두 맞혀야 한다.',
  ['낮은 보수 자체는 비윤리적인 것이 아님','그 보수로 기술적·전문적 기준을 준수하기 어려운 조건','전문가적 적격성과 정당한 주의에 대한 이기적 위협'],
  '낮은 보수 자체는 비윤리적인 것이 아니다. → 첫 요구만 충족. / 그 보수로 기준을 준수하기 어려우면 이기적 위협이 생긴다. → 자체의 허용 의미는 미언급.',
  '세 명제를 각각 1점으로 나누는 안을 권고한다. 위협 명칭과 그 대상 강령은 하나의 식별 명제이며 별도 점수를 더하지 않는다.'),
 ('T04-B','sub2','crit4','scope_choice',3,
  '현행 criterion은 분류·병합·상호참조의 세 기능이 모두 드러날 것을 명시한다. 한 기능을 정확히 알아도 현행 1점에서는 0점이다. 다만 발문은 기준서의 네 범주를 요구하므로 원전의 한 범주에 여러 기능이 열거된 구조도 고려해야 한다.',
  ['감사조서 분류','감사조서 병합','감사조서 상호참조'],
  '감사조서를 분류하고 병합한다. → 상호참조만 빠진 실질 부분답안.',
  '세 기능 전부를 유지하면 각각 1점 안이 합리적이다. 또는 네 행정적 범주를 식별하는 문항이라는 목적에 맞춰 한 범주 1점의 인정범위를 다시 정하는 선택지가 있다. 예시 자료 이름을 새 득점으로 만드는 제안은 아니다. 총괄의 범주 정책 결정이 선행해야 한다.'),
 ('T04-B','sub3','crit8','strong',2,
  '수정·추가한 주체와 시점은 독립된 추적 정보이다. 발문은 추가로 문서화할 사항을 모두 요구한다.',
  ['수정·추가한 사람의 기록','수정·추가한 시기의 기록'],
  '누가 수정하거나 추가했는지 문서화한다. → 시기 기록 의무는 미언급.',
  '사람과 시기를 각각 1점으로 분리하는 안을 권고한다. 실제 이름·날짜는 지문 사실도 아니며 만들 필요가 없다.'),
 ('T04-B','sub3','crit9','strong',2,
  '검토한 주체와 검토 시점도 서로 대체하지 않는 추적 정보이다. 작성자 기록과도 구별된다.',
  ['수정·추가를 검토한 사람의 기록','그 검토 시기의 기록'],
  '누가 변경을 검토했는지 기록한다. → 검토 시기 기록 의무는 미언급.',
  '검토자와 검토 시기를 각각 1점으로 분리하는 안을 권고한다. 작성자·검토자를 구별한 기존 경계는 유지한다.'),
 ('T17-A','sub3','crit6','strong',2,
  '발문은 보고서에 기술할 범위와 실질적 사유를 각각 요구한다. 범위 부족 표시 의무와 사유 설명 의무는 하나만 이행한 답안이 가능하다.',
  ['의견 표명에 감사범위가 충분하지 않았음을 보고서에 기술','의견거절의 실질적 사유를 보고서에 기술'],
  '보고서에 감사범위가 의견표명에 충분하지 않았음을 기술한다. → 실질적 사유의 보고는 미언급.',
  '두 보고 의무를 각각 1점으로 나누는 안을 권고한다. 이미 주어진 서면진술 거부 사실을 다시 쓰는 것만으로 사유 점수를 주지 않고 그 사유를 보고서에 기술해야 한다는 명제를 요구한다.'),
 ('T17-A','sub3','crit7','strong',2,
  '발문과 원문이 수행 절차의 식별, 일반적인 감사특성 문구의 제외를 모두 요구한다. 한 유형의 문구만 삭제한 보고서는 다른 요건을 충족하지 못한다.',
  ['수행한 절차 식별을 보고서에서 제외','일반적인 내부회계관리제도감사 특성 문구를 보고서에서 제외'],
  '의견거절 보고서에는 수행한 절차를 식별하여 적지 않는다. → 일반적 감사특성 문구의 제외는 미언급.',
  '두 문구 유형의 제외를 각각 1점으로 분리하는 안을 권고한다. 같은 의무의 긍정·부정 표현을 두 번 세는 안이 아니다.'),
 ('T19-A','sub3','crit5','root_comparison',2,
  '중요성 판단의 근거와 검토의 확신 수준 차이를 구별하는 요구가 한 criterion에 있다. 총괄의 전체 49세트 비교에 연결할 후보이다.',
  ['보고해야 하는 정보와 이용자의 요구를 바탕으로 중요성을 판단','검토의 낮은 확신·미발견위험과 중요성 판단기준을 구별'],
  '보고해야 하는 정보와 이를 신뢰·이용하는 측의 요구를 바탕으로 중요성을 판단한다. → 확신 수준의 차이와 명시적으로 구별하는 요구는 미언급.',
  '총괄의 2/1/3, 총 6점 검토안과 정합된다. 정보를 보고하고 이용하는 관점은 하나의 판단 근거로 유지한다. 확신 수준 차이와의 구별을 하나 더 분리하는 안이며 현재 문항·QA는 수정하지 않는다.'),
]

overview = {
 'T02-A':'높은 우선순위의 증점 후보 없음. 정의와 사례의 사실→개념 연결을 이미 분리했다. 정의의 핵심 조건을 단어 수대로 다시 쪼개지 않는다.',
 'T01-A':'crit5의 세 요구가 가장 분명하다. crit6의 시간·인력, crit7의 보수기준·서비스내용은 한 안전장치 예의 두 요소이므로 2차 비교 후보. crit4의 예외 조건과 사례 적용은 조건부 규칙 하나라는 해석도 가능하다.',
 'T03-A':'감사목적·범위, 보고서 형식·내용은 원전 목록의 결합 항목이다. 개별 단어를 독립 점수로 세기보다 현재 문항이 목록 항목을 요구한다는 목적을 우선한다.',
 'T04-B':'작성/검토 주체와 시기는 분리 우선. 행정적 변경 세 기능은 발문의 네 범주와 현행 strict 요구 사이 정책 선택이 필요하다. sub1의 이유는 최초 작성과 최종 취합의 관계를 설명하는 하나의 비교 명제로 유지 가능하다.',
 'T16-A':'전임 보고서의 대상과 당기 감사인의 전기 전체 확신 범위를 별도로 평가한다. 예외와 일반원칙을 하나의 조건부 규칙으로 평가하는 곳은 기계적으로 두 점을 주지 않는다.',
 'T16-B':'보고서일 전후 조치를 구별하고 법적 권리·의무 확인과 적절한 이용자 통지를 분리했다. 높은 우선순위 증점 후보 없음.',
 'T17-A':'sub3의 범위/사유, 두 보고 문구 제외는 분리 우선. crit8의 양 수신자·서면 방식은 커뮤니케이션 의무 하나라는 해석도 가능하여 2차 후보. sub1의 사례별 의견과 이유는 다른 판단형 문항들과 공통 정책 비교가 필요하지만 같은 판단을 두 표현으로 쓰게 하여 증점하지 않는다.',
 'T02-B':'감사의 고유한계에 관한 독립 요소 세 가지 및 평가 기준을 이미 분리했다. 현행 함축 답안 실측 변동은 별도 채점 경계 문제이며 증점 근거가 아니다.',
 'T01-B':'재무제표/보고서초안 검토 등 원전의 결합 검토 항목은 2차 비교 대상이다. 같은 검토의 대상 명사마다 자동 증점하지 않는다.',
 'T03-B':'변경 업무에 적합한 수행과 보고, 원래 절차 언급 금지의 예외는 관계·조건 명제이다. 현재 범위에서 높은 우선순위 증점 후보 없음.',
 'T04-C':'절차 성격·시기·범위는 절차 적절성의 범위이며 세 이름 자체를 각각 점수화하지 않는다. 수행중요성 정의의 독립 요구는 이미 나뉘어 있다.',
 'T15-A':'구체적 보고서 수정과 보고 단락 구별을 각각 평가한다. 제목만 또는 초안 문구만 반복하여 득점하도록 늘리지 않는다.',
 'T15-B':'sub2.crit3의 지배기구에 알릴 생략 의도와 위협 평가 내용은 2차 분리 후보. 발생가능성·심각성은 위협평가의 내용으로 하나의 범주에 유지 가능하다.',
 'T16-C':'KAM 결정과 논리적 근거는 한 판단 관계로 유지 가능하다. 결론 문구가 이유로 함축되는 것을 별도 요구가 빠졌다고 보아 증점하지 않는다.',
 'T14-C':'그룹업무팀 최종 책임과 지문에 이미 제시한 한도 정의를 구별한 후속본을 유지한다. 주어진 정의 재설명에 새 점수를 주지 않는다.',
 'T17-B':'sub1.crit2의 개별 통제에 별도 의견을 내지 않음과 필요한 통제테스트 범위는 2차 비교 후보. 하나의 통제 평가 범위를 설명하는 비교 명제로 유지할 근거도 있다.',
 'T18-A':'적용범주 여섯 개와 판정 사례 네 개를 각각 분리했다. 사례의 판단+결정적 이유 1점은 적용 관계의 정책 문제로 보며 판단 단어를 별도로 늘리지 않는다. 현행 criterion 누락 답안에 점수가 나온 모델 변동을 배점 변경의 이유로 삼지 않는다.',
 'T19-A':'총괄의 상세 검토 소유. sub3 근거/확신 구별 분리는 아래 제안과 연결한다. sub1 결론의 재무제표명·보고체계명·중요성 문구는 올바른 결론의 구성요소이므로 예시 자료명을 별도 득점으로 늘리지 않는다. sub2 생략 부적절/입수 의무는 같은 의무의 부정·긍정이다.',
}

records=[]
for pid,sid,cid,priority,proposed,reason,atoms,partial,recommendation in proposals:
    q=next(s for s in sets[pid]['subquestions'] if s['id']==sid)
    c=next(c for c in q['criteria'] if c['id']==cid)
    reqs=[r for r in q['requirements'] if r['source_ref_id'] in c['source_ref_ids']]
    records.append({'plan_id':pid,'set_id':sets[pid]['id'],'file':entry_by_id[pid]['file'],
      'file_sha256':digest(root/entry_by_id[pid]['file']), 'subquestion_id':sid,'criterion_id':cid,
      'priority':priority,'current_points':c['max_points'],'proposed_points_if_all_current_demands_retained':proposed,
      'prompt':q['prompt'],'current_claim':c['claim'],'source_ref_ids':c['source_ref_ids'],
      'source_spans':[{k:r.get(k) for k in ['source_ref_id','source_span']} for r in reqs],
      'reason':reason,'independent_demands':atoms,'partial_answer_boundary':partial,'recommendation':recommendation})

inventory=[]
for e in entries:
    s=sets[e['plan_id']]
    assert digest(root/e['file'])==e['sha256']
    inventory.append({'plan_id':e['plan_id'],'set_id':e['set_id'],'file':e['file'],'sha256':e['sha256'],
       'questions':len(s['subquestions']),'points':sum(c['max_points'] for q in s['subquestions'] for c in q['criteria']),
       'assessment':overview[e['plan_id']]})
record={'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'proposal_only_no_question_or_qa_changes',
 'manifest':str(manifest_file.relative_to(root)).replace('\\','/'),'manifest_sha256':digest(manifest_file),
 'scope':{'sets':len(inventory),'questions':sum(e['questions'] for e in inventory),'current_points':sum(e['points'] for e in inventory)},
 'policy':'독립된 요구의 부분 이해를 인정할 필요를 검토한다. 같은 의무의 긍정·부정, 이미 주어진 사실·자료 이름, 결론에 함축되는 판단 단어를 별도 증점하지 않는다. 현행 실행 입력과 기대값은 고정한다.',
 'inventory':inventory,'proposals':records,'api_calls_for_this_report':0}
json_path=out/'scoring-demand-review-18.json'
assert not json_path.exists()
json_path.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# 담당 18세트 독립 요구와 배점 검토 제안','',
 '현재 18세트·50물음·143점의 발문과 criterion을 대조했다. 아래 내용은 변경 제안이며 고정 문항·계획·QA·실측 로그를 변경하지 않았다. 전체 49세트의 배점 정책 및 주제 19 최종안은 총괄이 비교하여 결정한다.','',
 record['policy'],'',
 '## 우선 비교할 구체 후보','']
for r in records:
    lines += [f"### {r['plan_id']} {r['subquestion_id']}/{r['criterion_id']} — 현재 {r['current_points']}점",'',
      link(r['set_id'],r['file']), '',f"발문: {r['prompt']}",'',f"현재 계약: {r['current_claim']}",'',r['reason'],'',
      '독립 요구: '+' / '.join(r['independent_demands'])+'.','',
      '구별 가능한 부분답안: '+r['partial_answer_boundary'],'',r['recommendation'],'',
      '직접 근거: '+'; '.join(x['source_ref_id']+' — '+str(x['source_span']) for x in r['source_spans'])+'.','']
lines += ['## 전체 18세트 검토 범위','', '| 계획 | 현행 물음/점수 | 검토 판단 |','| --- | --- | --- |']
for r in inventory:
    lines.append('| '+link(r['plan_id'],r['file'])+' | '+str(r['questions'])+' / '+str(r['points'])+' | '+r['assessment']+' |')
lines += ['', '## 적용 전 조건','',
 '실제 변경은 총괄의 활성본 선택 이후 별도 후속 버전에서 수행해야 한다. 분리하는 경우 독립 criterion ID, 부분답안·동의·누락·반대·조건경계 QA, 총점과 요구 매핑, 새 비교은행 및 해당 실측의 재사용 가능성을 다시 확정한다. 이 보고서만으로 현재 점수를 수정하거나 과거 808사례를 새 배점 실측으로 승계하지 않는다.', '',
 '현재 실측의 5개 변동 사례는 별도 장부에 유지한다. 모델이 부분답안에 과하게 점수를 준 사실을 근거로 정답 계약을 느슨하게 만들지 않았다. 검토용 JSON에는 각 원파일의 실제 해시, 발문, claim, source ID·원문 위치를 보존했다.', '']
(out/'scoring-demand-review-18.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'scope':record['scope'],'proposals':len(records),'json':str(json_path.relative_to(root))},ensure_ascii=False))
