/** N05 manually authored content. Writes only this package; never calls a model. */
import fs from 'node:fs';
import {extendQa} from './extend-qa.mjs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const base=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const root=process.cwd();
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const hash=s=>createHash('sha256').update(s).digest('hex');
const write=(f,v)=>fs.writeFileSync(path.join(base,f),JSON.stringify(v,null,2)+'\n');
const rel=f=>path.relative(root,f).replaceAll('\\','/');
const source='cpa_uploader/data/official/kga600-2025-review14.txt';
const catalog=buildSourceCatalog();
const units=catalog.units.filter(u=>u.file===source);
const unit=p=>units.find(u=>u.paragraph===p);
const comparisons=read(path.join(base,'sources/official-comparison.json')).comparisons;
const locators=read(path.join(base,'sources/quote-locators.json')).rows;
const policy='2027년 CPA 시험 대비. 기본 사례는 2026년 1월 1일 개시·12월 31일 종료 보고기간의 재무제표감사로, 관련 업무는 2027년에 수행한다. 국내 KGA 600의 2025 개정 전문을 기준으로 한다. 2026 공식 전문의 600.7 및 관련 본문·적용자료를 직접 비교했다. 두 전문의 600.7은 2026년 1월 1일 이후 개시 보고기간부터 시행한다고 명시한다. 2027 금융위원회 시험범위 공고는 특정 판본을 지정하지 않는다. 국제 개정 ISA 600의 도입을 국내 개정 KGA 600 시행으로 간주하지 않는다. 이번 조사에서 별도 국내 개정 600 시행공고는 확보하지 않았으며, 확인한 공식 전문의 범위를 넘어서 부재를 단정하지 않는다.';
const quote=p=>{let q=unit(p).quote;if(p==='A47')q=q.slice(0,q.indexOf('보여주고 있다.')+'보여주고 있다.'.length);if(p==='A54')q=q.slice(0,q.indexOf('\n21 ')).trimEnd();return q;};
const refs=paras=>paras.map(p=>({id:`std-${p}`,file:source,title:`KGA 600 문단 ${p}, 2025 개정 전문; PDF ${locators.find(c=>c.paragraph===p)?.pdf_pages['2025'].join('·')||'sources/official-comparison.json 및 comparison-resolutions.json 참조'}`,page:'KGA 600',source_quote:quote(p),role:'standard',content_hash:hash(quote(p))}));
const between=(q,start,end)=>{const i=q.indexOf(start),j=end?q.indexOf(end,i+start.length):q.length;if(i<0||j<i)throw Error('Exact requirement quote boundary not found');return q.slice(i,j).trimEnd();};
// Full paragraphs and dependencies remain in source_refs. A requirement quotes its directly supporting clause.
const requirementQuote=(set,qi,j,p)=>{
 const q=quote(p);
 if(p==='A55')return j===0?between(q,'(c)','(d)'):between(q,'(f)','연결절차');
 if(p==='27')return j===0||j===3?between(q,'(a)','(b)'):j===1?between(q,'(b)','(c)'):j===2?between(q,'(c)','유의적이지 않은 부문들'):between(q,'27.','(a)');
 if(p==='29'){
  const bullets=[...q.matchAll(/^.*$/gm)];
  if(j===0)return between(q,'이러한 경우에는','');
  if(j>=1&&j<=4)return bullets[j-1][0];
  if(j===5)return q.slice(bullets[0].index,bullets[2].index+bullets[2][0].length);
  if(j===6)return between(q,'그룹업무팀은 기간 경과에 따라','부문감사인이 수행한 업무에 대한 관여');
 }
 return q;
};
const spec=(claim,paragraph,opposite,scope)=>({claim,paragraph,opposite,scope});
const a={plan:'T14-A',id:'pilot-14-006',title:'부문감사인의 독립성 결격과 적격성 우려에 대한 대응',points:[2,3],paras:['7','9','19','20','A39','A40','A41','A54','A55'],facts:[
 '한울그룹의 그룹업무팀은 2026년 1월 1일부터 12월 31일까지의 그룹재무제표를 2027년에 감사하고 있다. 다음 A·B·C 부문감사인의 상황은 서로 독립적이다.',
 'A 부문감사인은 그룹감사에 적용되는 독립성 요구사항을 충족하지 못한다. 이 사실은 해소되지 않은 상태이다. 담당자는 그룹업무팀의 감사조서 검토를 강화하여 A에게 부문재무정보의 업무를 맡기자고 제안했다.',
 'B 부문감사인은 독립성 요구사항을 충족한다. 해당 산업의 특수한 거래에 대한 지식이 부족하다는 우려는 있으나, 전문가적 적격성에 대한 우려가 심각한 수준은 아니다. 그룹업무팀은 B의 업무에 충분히 관여할 수 있고 관련 감사문서에도 접근할 수 있다.',
 'C 부문감사인은 독립적이나, 그룹업무팀은 C의 전문가적 적격성에 심각한 우려를 갖고 있다. 이 우려가 해소되지 않은 상태에서 C에게 업무를 요청할 것인지 검토한다.'
 ],qs:[
 {type:'judgment',prompt:'A 부문감사인에 대한 담당자의 제안이 가능한지 판단하시오. 또한 해당 부문재무정보의 감사증거를 입수하기 위하여 그룹감사인이 취해야 할 대안을 설명하시오.',claims:[
 spec('감사조서 검토를 강화하더라도 독립성 요구사항을 충족하지 못하는 A 부문감사인에게 해당 업무를 요청할 수 없다.','A39','조서 검토를 강화하면 독립성 결격을 극복할 수 있으므로 A에게 업무를 요청할 수 있다.','독립성 결격이 해소되지 않은 사례에 한정한다. 그룹감사인이 A의 업무에 의존하지 않고 직접 증거를 확보한다고 쓰면 업무 요청 불가 판단도 함축하므로 인정한다.'),
 spec('그룹감사인이 해당 부문재무정보에 관하여 충분하고 적합한 감사증거를 입수하여야 한다.','20','그룹감사인은 해당 부문재무정보에 관한 충분하고 적합한 감사증거를 입수할 필요가 없다.','그룹감사인 또는 그룹업무팀이 직접 필요한 감사절차를 수행하여 충분하고 적합한 증거를 확보한다는 의미를 인정한다. 단순한 조서 검토 강화로 A의 업무를 이용한다는 대안은 인정하지 않는다.')
 ],equivalent:'A의 독립성 결격은 조서 검토를 늘려도 치유되지 않으므로 의뢰할 수 없다. 그룹업무팀 스스로 필요한 감사를 실시하여 그 부문의 재무정보에 대한 충분·적합한 증거를 확보해야 한다.'},
 {type:'descriptive',prompt:'B의 산업지식 부족에 관한 우려를 다루기 위하여 그룹업무팀이 취할 수 있는 관여를 ① 위험평가절차 수행과 ② 관련 감사문서 검토의 각 측면에서 구체적으로 설명하시오. 또한 C의 경우에는 C에게 부문재무정보에 관한 업무를 요청할 수 있는지 판단하시오.',claims:[
 spec('B에 대한 심각하지 않은 우려에 대응하여 그룹업무팀은 직접 또는 B와 함께 부문 수준의 위험평가절차를 수행하는 등 위험평가에 관여할 수 있다.','A55','심각하지 않은 산업지식 우려에 대응하여 그룹업무팀이 B의 위험평가절차에 관여하는 것은 허용되지 않는다.','A40의 가능한 대응을 A54 및 A55(c)의 구체적 관여로 설명한다. 부문감사인의 위험평가에 추가로 관여하거나 직접 추가 위험평가를 수행한다는 동의 표현을 인정한다. 이 행위만이 유일한 대응이거나 모든 부문에서 항상 필수라는 주장은 요구하지 않는다.'),
 spec('B에 대한 심각하지 않은 우려에 대응하여 그룹업무팀은 해당 산업의 중요한 계정 등과 관련된 B의 감사문서를 검토할 수 있다.','A55','그룹업무팀은 B의 산업지식 부족에 대응하기 위하여 관련 감사문서를 검토해서는 안 된다.','A55(f)의 기타 관련 감사문서 검토를 사례에 적용한다. 중요한 계정에 관한 감사조서 검토 또는 우려와 관련된 감사문서 검토를 인정한다. 특정 계정 명칭이나 모든 감사문서의 전수 검토는 요구하지 않는다.'),
 spec('전문가적 적격성에 심각한 우려가 해소되지 않은 C에게는 부문재무정보에 관한 업무를 요청할 수 없다.','20','C의 전문가적 적격성에 심각한 우려가 해소되지 않아도 조서 검토를 강화하여 C에게 업무를 요청할 수 있다.','C의 심각한 우려에 20을 적용한다. B의 경미한 우려까지 무조건 업무 금지로 확대하지 않는다. C에 대한 감사증거 대안까지 추가 배점하지 않는다.')
 ],equivalent:'B와 함께 부문 중요왜곡표시위험의 식별·평가에 참여할 수 있고, 산업지식 우려와 관련된 주요 계정의 조서를 검토할 수 있다. 반면 심각한 적격성 우려가 남아 있는 C에게는 해당 업무를 맡길 수 없다.'}
 ],difference:'pilot-14-001/sub2/crit2~crit5는 부문감사인의 적격성·독립성 등 이해사항이다. 새 세트는 이해 결과의 결격·경미한 우려에 대한 대응을 적용한다. pilot-14-004/sub2/crit4·crit8은 사후 커뮤니케이션 평가와 기타 문서 검토 필요성 결정이다. T14-A는 산업지식 우려를 다루기 위한 구체 관여이며 A55(f)에 따른 같은 조치의 의도적 심화다. 일반 보완 가능성과 그 구체 행위를 중복 배점하지 않는다.',exceptions:[
 'A39는 독립성 결격을 추가 관여·위험평가·추가감사절차로 극복하지 못한다고 명시한다. A40의 경미한 적격성 우려와 구분한다.',
 'A41의 법규상 감사문서 접근금지는 B의 사실관계와 다르다. 비망록으로 해결할 수 있다는 규정을 독립성 결격의 치유로 이용하지 않는다.',
 'B 물음은 가능한 대응 전체 목록을 묻지 않는다. 위험평가 수행과 문서 검토라는 지정된 두 측면에서 가능한 관여를 묻는다. A55의 다른 관여도 존재하며 이 두 조치를 언제나 의무라고 주장하지 않는다.'
 ]};
const b={plan:'T14-B',id:'pilot-14-007',title:'부문의 유의성과 추가 업무유형의 결정',points:[2,5,7],paras:['7','9','21','26','27','28','29','A43','A44','A47','A48','A49','A50','A51','A52','A53'],facts:[
 '다온그룹의 그룹업무팀은 2026년 1월 1일부터 12월 31일까지의 그룹재무제표를 2027년에 감사하고 있다. 부문감사인은 독립성 등 관련 요구사항을 충족하며 그룹업무팀의 필요한 관여에도 제한이 없다.',
 'A 부문은 그룹에 대하여 개별적으로 재무적 유의성이 있는 부문으로 식별되었다. B 부문은 개별적으로 재무적 유의성은 없지만, 고유한 거래의 성격 때문에 그룹재무제표의 유의적인 중요왜곡표시위험을 포함할 것 같아서 유의적 부문으로 식별되었다.',
 'C군은 유의적이지 않은 여러 부문으로 구성된다. 그룹업무팀은 유의적 부문의 재무정보에 대한 업무, 그룹차원의 통제와 연결절차에 대한 업무, 그룹 수준의 분석적절차를 통하여 그룹감사의견의 근거가 되는 충분하고 적합한 감사증거를 입수하지 못할 것으로 예상한다.'
 ],qs:[
 {type:'descriptive',prompt:'A 부문에 대하여 그룹업무팀 또는 그룹업무팀을 대신하는 부문감사인이 수행하여야 할 업무유형과 그 업무에 사용할 중요성을 각각 제시하시오.',claims:[
 spec('A 부문의 재무정보에 대한 감사를 수행하여야 한다.','26','A 부문에는 부문재무정보에 대한 검토만 수행하면 충분하다.','전체 부문재무정보의 감사를 뜻하며, 특정 계정에 한정한 감사나 검토만으로 대체한다는 답은 인정하지 않는다. 중요성 기준은 다음 criterion에서 따로 평가한다.'),
 spec('A 부문재무정보 감사에는 부문중요성을 사용한다.','26','A 부문재무정보 감사에는 부문중요성 대신 그룹재무제표 전체에 대한 중요성을 그대로 사용한다.','중요성의 명칭을 요구한다. 금액·비율·그룹중요성 대비 크기의 추가 설명은 요구하지 않는다.')
 ],equivalent:'A의 부문재무정보 전체를 감사하여야 하며, 그 감사에는 해당 부문의 중요성을 적용한다.'},
 {type:'enumeration',prompt:'B 부문에 대하여 수행할 수 있는 업무유형을 감사기준서 600 문단 27의 범위에서 모두 제시하시오. 부문재무정보 전체를 감사하는 대안에서 사용할 중요성도 제시하고, 열거한 업무유형을 실제로 모두 수행해야 하는지 또는 어떻게 선택하여 수행할 수 있는지 설명하시오.',claims:[
 spec('B 부문의 재무정보 전체에 대한 감사를 수행할 수 있다.','27','B 부문의 재무정보 전체에 대한 감사는 선택할 수 있는 업무유형이 아니다.','전체감사 대안의 명칭을 평가한다. 사용 중요성은 별도 criterion에서 평가하며, 검토는 27(a)의 대안이 아니다.'),
 spec('그룹재무제표의 발생가능한 유의적인 중요왜곡표시위험과 관련된 하나 이상의 거래유형·계정잔액 또는 공시에 대하여 감사를 수행할 수 있다.','27','B에 대해서는 유의적 위험과 무관한 계정만 감사하는 것으로 위험 관련 항목의 감사를 대체할 수 있다.','위험과 관련된 특정 항목 감사라는 범위를 보존한다. 거래유형·계정잔액·공시는 대안적인 대상이므로 세 범주를 모두 실제 감사한다고 요구하지 않는다.'),
 spec('그룹재무제표의 발생가능한 유의적인 중요왜곡표시위험과 관련된 특정 감사절차를 수행할 수 있다.','27','B에 대해서는 유의적 위험과 관련 없는 특정 절차만 수행하는 것으로 위험 대응을 대체할 수 있다.','A49의 위험에 대응한 특정 감사절차를 뜻한다. 특정절차와 특정 항목 감사는 별개 대안이다.'),
 spec('부문재무정보 전체를 감사하는 대안에는 부문중요성을 사용한다.','27','B 부문재무정보 전체 감사에는 부문중요성이 아니라 그룹재무제표 전체 중요성을 그대로 적용한다.','27(a)의 중요성 기준을 독립 평가한다. 27(b)·(c)의 특정 항목 감사·특정절차에 동일 명칭을 일괄 사용한다고 답하도록 확대하지 않는다.'),
 spec('위 업무유형 중 하나 이상을 수행하여야 하며, 세 유형을 모두 동시에 수행할 의무는 없다.','27','위 세 업무유형은 항상 전부 동시에 수행하여야 한다.','필요한 하나 또는 여러 대안을 선택하여 수행한다는 의미를 인정한다. 아무 업무도 하지 않아도 된다는 뜻이나 정확히 하나만 가능하다는 뜻은 인정하지 않는다.')
 ],equivalent:'부문재무정보 전체 감사, 유의적 위험과 연관된 특정 거래·잔액·공시의 감사, 그 위험에 대응하는 특정 감사절차가 가능하다. 전체감사라면 부문중요성을 적용한다. 세 가지 중 적절한 하나 또는 여러 가지를 수행하며 반드시 셋을 전부 해야 하는 것은 아니다.'},
 {type:'enumeration',prompt:'C군과 관련하여 그룹업무팀이 추가로 취할 부문 선정 조치를 제시하시오. 선정된 부문에서 선택할 수 있는 업무유형을 감사기준서 600 문단 29의 범위에서 모두 열거하고, 그중 부문재무정보 전체의 감사 또는 검토에 사용할 중요성을 제시하시오. 또한 기간이 경과할 때 부문 선택에 적용할 원칙을 설명하시오.',claims:[
 spec('그룹업무팀은 C군의 유의적이지 않은 부문 중 일부를 추가 업무 대상으로 선정하여야 한다.','29','C군은 유의적이지 않으므로 어떤 부문도 추가 업무 대상으로 선정할 필요가 없다.','유의적이지 않은 부문 중 일부를 추출한다는 대상·조치를 평가한다. 임의의 고정 수나 전 부문 전수감사를 요구하지 않는다.'),
 spec('선정된 개별 부문의 재무정보 전체에 대한 감사를 수행할 수 있다.','29','선정된 부문재무정보 전체의 감사는 선택 가능한 업무유형이 아니다.','부문재무정보 감사라는 업무유형을 평가한다. 중요성은 별도 criterion에서 평가한다.'),
 spec('선정된 부문의 하나 이상의 거래유형·계정잔액 또는 공시에 대한 감사를 수행할 수 있다.','29','선정된 부문의 특정 거래유형·계정잔액 또는 공시에 한정한 감사는 선택할 수 없다.','하나 이상의 특정 항목을 대상으로 하는 감사 대안이다. 27(b)와 달리 원문 29에 없는 유의적 위험 관련성 표현을 필수요건으로 추가하지 않는다.'),
 spec('선정된 개별 부문의 재무정보 전체에 대한 검토를 수행할 수 있다.','29','선정된 부문재무정보에 대한 검토는 허용되지 않고 반드시 감사해야 한다.','감사와 검토를 서로 다른 업무유형으로 인정한다. 검토업무기준 번호·상세 수행절차까지 요구하지 않는다.'),
 spec('선정된 부문에 대하여 특정의 절차를 수행할 수 있다.','29','선정된 부문에 대한 특정 절차의 수행은 선택 가능한 업무유형이 아니다.','특정절차 또는 특정 감사절차라는 의미를 인정한다. 특정 항목 감사만 쓰는 답과 구별한다.'),
 spec('선정된 부문재무정보 전체에 대한 감사 또는 검토에는 부문중요성을 사용한다.','29','선정된 부문재무정보의 전체 감사나 검토에는 부문중요성을 사용하지 않고 그룹재무제표 전체 중요성을 그대로 사용한다.','전체감사와 검토에 공통 적용하는 중요성 기준 한 명제를 평가한다. 전체감사와 검토 모두를 포괄하는 답이면 1점이며 같은 명칭을 반복하도록 요구하지 않는다. 둘 중 한 업무에만 적용한다고 한정하거나 다른 업무에서는 부정하면 충족하지 않는다. 특정 항목 감사·특정절차 모두에 부문중요성을 일괄 적용해야 한다는 요구는 아니다.'),
 spec('그룹업무팀은 기간의 경과에 따라 추가 업무 대상 부문의 선택을 변경하여야 한다.','29','매 기간 동일한 부문만 계속 선정해야 하며 선택을 변경하면 안 된다.','기간 경과에 따른 선택 변경을 뜻한다. A51의 순환 선정도 인정하지만 매년 모든 선정 부문을 반드시 교체해야 한다는 특정 주기를 요구하지 않는다.')
 ],equivalent:'유의적이지 않은 C군에서 일부 부문을 뽑아 추가 업무를 한다. 가능한 유형은 부문재무정보 전체 감사, 특정 거래나 잔액 또는 공시 감사, 부문재무정보 전체 검토, 특정 절차이다. 전체감사와 검토는 부문중요성을 사용한다. 시간이 흐르면 선정하는 부문을 바꾸어야 한다. 나열한 업무를 전부 동시에 해야 한다는 의미는 아니며 적절한 하나 이상을 선택한다.'}
 ],difference:'pilot-14-003/sub2/crit7은 업무유형 개요를 지배기구에 전달하는 커뮤니케이션이고, pilot-14-002/sub1/crit3 및 sub2/crit9는 부문중요성의 크기·전달사항이다. 새 세트는 26~29의 유의성별 업무유형과 추가 선정·선택 변경을 직접 요구한다. 중요성 명칭은 업무유형과 연결하기 위한 의도적 복습이며 새 요소 빈도로 중복 집계하지 않는다. S05/T14-C의 중요성 결정권·수행중요성 검증·보고한도·합계 오해를 배점하지 않는다.',exceptions:[
 'A의 재무적 유의성, B의 고유 위험에 따른 유의성, C의 비유의성을 이미 판단한 사실로 제공한다. 유의성 판단 자체를 다시 득점하지 않는다.',
 'B의 세 업무유형은 27에 따라 하나 이상을 실제 수행하는 대안이다. 유형을 모두 열거하라는 발문을 모두 동시에 수행하라는 의무로 바꾸지 않는다.',
 'C의 네 업무유형도 29에 따라 하나 이상을 실제 수행하는 대안이다. Q3는 가능한 유형을 모두 열거하라는 요구로, 하나 이상이라는 관계 자체는 Q2에서만 별도 배점한다. Q3 모범답안의 관계 설명은 목록을 의무로 오독하지 않게 하는 설명이며 숨은 추가 점수는 없다.',
 '26·27(a)·29의 전체 부문재무정보 감사, 29의 전체 부문재무정보 검토에 적용할 부문중요성을 유형과 분리해 평가한다. 27(b)·(c)와 29의 나머지 유형에 동일 기준을 일괄 적용하도록 확대하지 않는다.',
 'C군에서 증거 부족의 전제가 없다면 일반적으로 28의 그룹 수준 분석적절차가 적용된다. 이 사례는 29의 부족 예상 조건을 명시하여 추가 선정을 묻는다. 모든 부문이 비유의적인 그룹에서도 A53에 따라 증거를 확보해야 한다.',
 '600.A47 뒤 도표는 일부 셀의 원문 표시가 잘려 있어 완전열거의 유일한 근거로 쓰지 않는다. 공식 본문 26~29와 A48~A53 전문을 정답 근거로 사용한다.'
 ]};
const all=[a,b];const lineage=[];
for(const s of all){
 const assigned=Object.values(read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json')).find(Array.isArray).find(x=>x.plan_id===s.plan);
 if(assigned.set_id!==s.id)throw Error('ID ledger mismatch');
 const set={schema_version:'3.0',id:s.id,type:'linked_question_set',status:'needs_review',title:s.title,
 classification:{topic_id:'14',part:'PART4',chapter:'그룹감사',domain:'audit',standards:['KGA 600'],tags:['그룹감사','부문감사인',...(s===a?['독립성','전문가적 적격성','위험평가','감사문서']:['유의적 부문','부문재무정보','업무유형','부문중요성'])]},source_refs:refs(s.paras),
 shared_context:{facts:s.facts.map((text,i)=>({id:`f${i+1}`,text,scoreable:false}))},learning_order:s.qs.map((_,i)=>`sub${i+1}`),
 subquestions:s.qs.map((q,i)=>({id:`sub${i+1}`,type:q.type,prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:q.type==='judgment'?{options:['가능하다','가능하지 않다'],correct:'가능하지 않다'}:null,answer_slots:[{id:`sub${i+1}.answer`,label:'답안',input:'textarea'}],model_answer:q.claims.map(x=>x.claim),requirements:q.claims.map((x,j)=>({id:`sub${i+1}.req${j+1}`,source_ref_id:`std-${x.paragraph}`,source_quote:requirementQuote(s,i,j,x.paragraph),source_span:`KGA 600.${x.paragraph}; ${unit(x.paragraph).locator}; 적용범위: ${x.scope}`})),criteria:q.claims.map((x,j)=>({id:`sub${i+1}.crit${j+1}`,requirement_id:`sub${i+1}.req${j+1}`,claim:x.claim,critical_facts:[{id:`sub${i+1}.crit${j+1}.fact`,type:'action',expected:x.claim},{id:`sub${i+1}.crit${j+1}.scope`,type:'condition',expected:x.scope}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[`std-${x.paragraph}`,...(s===a&&i===1&&j<2?['std-A40']:[])]}))})),
 verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[policy,'총괄 ID 장부에 따른 수동 제작. 공식 원문 인용은 등록 파일의 exact 부분문자열을 사용하고, 사례·발문·답안은 새로 작성했다.','1차 draft_ready는 정적 형상·출처·작성자 QA 준비 상태이다. 실제 의미검수·모델 채점은 최종 비교은행 고정 후 수행한다.','source packet은 수동 근거 장부 evidence-packet 파일로 구분한다. 생성기 출제 계획 해시 표시가 없는 수동 초안이며 자동 생성 source-packet 계약을 사칭하지 않는다.']}};
 const filename=`${s.id}.json`;write(filename,set);
 const plan={version:1,set_id:s.id,topic_id:'14',mode:'adapt_existing_question',status:'ready',objective:s.title,scope:{actors:['그룹업무팀 및 그룹업무수행이사','그룹업무팀의 요청으로 부문재무정보에 대한 업무를 수행하는 부문감사인'],timing:[s.facts[0]],conditions:s.facts.slice(1),exceptions:s.exceptions,required_answers:s.qs.map(q=>q.prompt),exclusions:['금액 계산, 유의성 비율 계산, 그룹업무수행이사의 책임경감 일반론, 감사의견 변형, 연결조정·제거, 중요성 결정권·보고한도·부문중요성 합계 문제는 출제하지 않는다.','정본 편입·공개본 생성·게시·배포는 수행하지 않는다.']},question_types:[...new Set(s.qs.map(q=>q.type))],source_unit_ids:s.paras.map(p=>unit(p).id),existing_question_difference:s.difference,edition_assumption:policy,unresolved_items:[]};
 write(filename+'.authoring-plan.json',{artifact_type:'question_authoring_plan',version:1,plans:[plan]});
 write(`evidence-packet-${s.plan.toLowerCase()}.json`,{artifact_type:'manual_source_evidence_packet',plan_id:s.plan,set_id:s.id,not_generated_source_packet:true,automatic_packet_completeness:'not_claimed',model_input:'Official quotes are all in draft.source_refs; required scope/dependencies are in the version1 plan. This evidence file is not automatically fed to review.',source_file:source,source_sha256:sha(source),pdf_comparison:'sources/official-comparison.json',comparison_resolution:'sources/comparison-resolutions.json',units:s.paras.map(p=>({id:unit(p).id,paragraph:p,locator:unit(p).locator,quote:quote(p),quote_sha256:hash(quote(p)),authority:unit(p).authority})),requirements:set.subquestions.map(q=>({question:q.id,prompt:q.prompt,criteria:q.criteria.map(c=>({id:c.id,points:c.max_points,claim:c.claim,requirement:q.requirements.find(r=>r.id===c.requirement_id)}))}))});
 const cases=[];
 for(let qi=0;qi<s.qs.length;qi++){
  const q=s.qs[qi],sq=set.subquestions[qi],n=q.claims.length;
  const add=(kind,answer,verdicts,note='')=>cases.push({id:`${sq.id}/${kind}`,subquestion_id:sq.id,kind,answer,expected_points:verdicts.filter(v=>v==='met').length,expected_verdicts:verdicts.map((v,j)=>({criterion_id:sq.criteria[j].id,verdict:v,reason:v==='met'?'답안 전체가 원문에 근거한 독립 명제를 충족한다.':v==='contradicted'?'해당 명제의 대상·조건·행위를 명시적으로 부정한다.':'다른 답안 부분을 함께 읽어도 해당 명제를 확인할 수 없다.'})),note});
  const yes=()=>Array(n).fill('met');const clauses=q.claims.map(c=>c.claim);
  add('stored-model',clauses.join('\n'),yes());add('equivalent',q.equivalent,yes());add('reverse',clauses.toReversed().join('\n'),yes());add('single-sentence',clauses.map(x=>x.replace(/\.$/,'')).join('; ')+'.',yes());add('irrelevant-prefix','연결재무제표에는 여러 부문의 재무정보가 포함된다.\n'+q.equivalent,yes(),'무관한 문장을 앞에 붙여도 뒤의 정답을 잘라내지 않는다.');add('empty','',Array(n).fill('not_met'));
  for(let j=0;j<n;j++){
   let remaining=clauses.filter((_,k)=>j!==k);
   // Remove redundant type names from a still-correct materiality answer when testing a true type omission.
   if(s===b&&qi===0&&j===0)remaining=['사용할 중요성은 부문중요성이다.'];
   if(s===b&&qi===1&&j===0)remaining=remaining.map(t=>t===clauses[3]?'재무정보 전체를 대상으로 하는 대안에서 사용할 중요성은 부문중요성이다.':t);
   if(s===b&&qi===2&&(j===1||j===3))remaining=remaining.map(t=>t===clauses[5]?'물음에서 중요성을 요구한 두 업무에 공통으로 부문중요성을 사용한다.':t);
   const omit=remaining.join('\n');const v=yes();v[j]='not_met';
   if(s===a&&qi===0&&j===0){v[j]='met';add(`omit-sentence-${j+1}`,omit,v,'직접 증거를 확보해야 한다는 대안이 A의 업무에 의존할 수 없다는 판단을 함축하는 것으로 인정한다. 문장 삭제를 진짜 판단 누락으로 오표시하지 않는다.');}
   else add(`omit-${j+1}`,omit,v);
   const vs=yes();vs[j]='contradicted';add(`opposite-${j+1}`,clauses.map((t,k)=>k===j?q.claims[j].opposite:t).join('\n'),vs,'해당 반대 명제만 0점. 별개로 충족한 명제의 점수는 유지한다.');
  }
  if(s===a&&qi===0){add('implicit-judgment','A에게 의존하지 않고 그룹감사인이 직접 해당 부문의 재무정보에 관한 필요한 감사를 수행하여 충분하고 적합한 증거를 입수한다.',yes(),'판단 문구 없이 대안에서 결론이 분명하다.');add('judgment-only','A에게 업무를 요청할 수 없다.',['met','not_met']);}
  if(s===a&&qi===1){add('mild-versus-serious','B의 경미한 우려에는 직접 위험평가에 참여하고 관련 조서를 검토할 수 있다. C도 우려가 심각하더라도 문서 검토만 강화하면 업무를 맡길 수 있다.',['met','met','contradicted'],'경미함과 심각함의 조건 경계');}
  if(s===b&&qi===1){add('exactly-one',clauses.slice(0,4).join('\n')+'\n세 업무 중 정확히 하나만 수행할 수 있고 둘 이상을 함께 수행할 수는 없다.',['met','met','met','met','contradicted']);add('review-instead',clauses.slice(1).join('\n')+'\n전체감사 대신 전체검토만 수행하는 것이 첫 번째 대안이다.',['contradicted','met','met','met','met'],'27에는 전체검토 대안이 없다. 나머지 독립 명제는 유지한다.');}
  if(s===b&&qi===2){add('names-with-shared-materiality','C군 중 일부를 추가 선정한다. 전체감사·특정 항목 감사·전체검토·특정절차 중 선택하며 전체감사와 전체검토는 공통으로 부문중요성을 사용한다. 선정 부문은 시간이 흐르면 순환하여 바꾼다.',yes(),'명칭 나열·공통 중요성 표현·순환 선정 허용');const v=yes();v[5]='not_met';add('materiality-audit-only',clauses.map((t,j)=>j===5?'전체감사에는 부문중요성을 사용한다.':t).join('\n'),v,'전체감사에만 범위를 한정했고 검토의 중요성은 빠져 공통 조건을 충족하지 않는다.');add('review-materiality-denied',clauses.map((t,j)=>j===5?'전체감사에는 부문중요성을 사용하지만 검토에는 부문중요성을 사용하지 않는다.':t).join('\n'),yes().map((x,j)=>j===5?'contradicted':x));}
 }
 write(`qa-cases-${s.plan.toLowerCase()}.json`,extendQa(set,{version:1,artifact_type:'author_expected_judgments',set_id:s.id,draft_sha256:sha(path.join(base,filename)),live_model_grading:'not_run',human_approval:false,expectation_policy:'공식 원문·발문·독립 명제와 G1/G3로 사전 결정. 실제 모델 결과가 아니며 점수 합산 검사는 실측이 아니다.',cases}));
 lineage.push({plan_id:s.plan,set_id:s.id,plan_question_map:s.qs.map((_,i)=>({plan_question_id:`${s.plan}-Q${i+1}`,subquestion_id:`sub${i+1}`,points:s.points[i]})),kind:'new',stage:'candidate_prepared',actual_file:rel(path.join(base,filename)),sha256:sha(path.join(base,filename)),plan_file:rel(path.join(base,filename+'.authoring-plan.json')),plan_sha256:sha(path.join(base,filename+'.authoring-plan.json')),qa_file:rel(path.join(base,`qa-cases-${s.plan.toLowerCase()}.json`)),qa_sha256:sha(path.join(base,`qa-cases-${s.plan.toLowerCase()}.json`)),evidence_file:rel(path.join(base,`evidence-packet-${s.plan.toLowerCase()}.json`))});
}
write('lineage.json',{package:'N05',stage:'candidate_prepared',id_ledger:'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json',sets:lineage});
write('design-changes.json',{scope:'N05 1차 제작',approved_by:'총괄의 대화 승인; 사용자 전체 제작 범위 내 정수 명제 분리',previous:{sets:2,questions:5,points:17},current:{sets:2,questions:5,points:19},global_provisional_points:{before:377,after:379},changes:[{question:'T14-A-Q2',before:3,after:3,reason:'일반 보완 가능성의 중복 배점 대신 위험평가 수행 1·관련 문서 검토 1·심각한 우려 업무 미요청 1. 지정된 두 측면의 사례적 관여이며 가능한 대응의 유일·필수 전체목록 아님.'},{question:'T14-B-Q2',before:4,after:5,reason:'27(a)의 전체감사 업무유형과 그때 사용할 부문중요성을 각각 독립 1점으로 평가.'},{question:'T14-B-Q3',before:6,after:7,reason:'29의 전체감사·검토에 공통 적용할 부문중요성 기준을 업무유형과 분리해 독립 1점.'}]});
const datasetFile='cpa_uploader/analysis/question-elements/question-elements.json';const ds=read(datasetFile);
const elementMap=[['T14-A','sub1','group.independence-not-remedied-by-review'],['T14-A','sub2','element-f2abc19ef137fa24'],['T14-B','sub1','element-303383e8241e1fc5'],['T14-B','sub2','element-07e32d98036a4aee'],['T14-B','sub3','element-82a95cff37dabedd']];
write('frequency-evidence.json',{artifact_type:'n05_frequency_evidence',dataset:datasetFile,sha256:sha(datasetFile),policy:'기출/모의/연습/OX는 분리. 교재 재수록만 중복 제외. 새 중요성 분리 배점은 기존 유형 요소에 연결한 의도적 복습이며 별도 빈도 또는 신규 커버리지로 가산하지 않는다.',elements:elementMap.map(([plan,question,id])=>{const e=ds.elements.find(x=>x.id===id);return {plan_id:plan,subquestion_id:question,element_id:id,label:e.label,relationship:'direct',relationship_limit:plan==='T14-A'&&question==='sub2'?'경미한 우려의 관여는 direct; 심각한 우려의 업무 미요청은 인접 적용경계로 이 요소 빈도에 별도 합산하지 않는다.':'물음의 업무유형·판단 요구에 직접 대응하며 중요성 기준의 별도 빈도를 뜻하지 않는다.',exam_frequency:e.exam_frequency,mock_frequency:e.mock_frequency,exam_years:e.exam_years,exam_questions:e.exam_questions,mock_questions:e.mock_questions,practice_occurrences:e.practice_occurrences,records:e.occurrence_ids.map(oid=>{const o=ds.occurrences.find(x=>x.id===oid);const r=ds.records.find(x=>x.id===o.record_id);return {occurrence:o,record:r};})};})});
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';const bank=read(bankFile);
write('comparison-notes.json',{bank_file:bankFile,bank_sha256:sha(bankFile),comparison_initial:'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json',comparison_initial_sha256:sha('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json'),current_topic_bank:bank.filter(s=>s.classification.topic_id==='14').map(s=>({set_id:s.id,title:s.title,subquestions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim}))}))})),differences:all.map(s=>({plan_id:s.plan,difference:s.difference})),peer_boundary:'S05 T14-C는 중요성 결정·검증 주체/보고한도/합계 산술배분을 담당한다. N05는 업무유형에 사용할 중요성 명칭만 묻는다. 최종49 비교은행은 총괄 고정 후 재검사한다.'});
console.log(JSON.stringify({sets:2,questions:5,points:19,files:lineage.map(s=>s.actual_file)}));
