import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../../../questionSourceCatalog.mjs';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11',out=`${D}/c/official-source-remediation-v1`;
const bankFile=`${D}/prepared-reviewed-v4/candidate-authoring.json`,bankBytes=fs.readFileSync(bankFile),bank=JSON.parse(bankBytes);
const sha=x=>createHash('sha256').update(x).digest('hex');
const norm=x=>x.replace(/\s+/gu,'');
const stage=JSON.parse(fs.readFileSync(`${out}/stage-evidence.json`,'utf8'));
const target=stage.target_file,targetText=fs.readFileSync(target,'utf8');
if(sha(targetText)!==stage.sha256)throw Error('Registered source hash mismatch');
const catalog=buildSourceCatalog(),registered=catalog.units.filter(u=>u.file===target&&u.authority==='official_transcription');
const rows=JSON.parse(fs.readFileSync(`${D}/official-source-remediation-inventory-v1.json`,'utf8')).rows.filter(r=>['04','05','06'].includes(r.topic_id));
const map={
 'pilot-04-001/src11':['300','A10'], 'pilot-04-001/src14':['320','13'],
 'pilot-04-002/src1':['300','6'],'pilot-04-002/src2':['300','12'],
 'pilot-04-004/src1':['230','7'],'pilot-04-004/src2':['230','8'],
 'pilot-04-005/src1':['230','15'],'pilot-04-005/src2':['320','14'],
 'pilot-05-001/src1':['240','42'],'pilot-05-001/src6':['260','7'],
 'pilot-05-002/src1':['240','33','a'],'pilot-05-002/src2':['240','33','b'],
 'pilot-05-003/src1':['265','9'],'pilot-05-003/src2':['265','11'],
 'pilot-05-005/src1':['240','27','first-sentence'],'pilot-05-005/src2':['240','28'],'pilot-05-005/src3':['240','48'],
 'pilot-05-006/src1':['240','33','bii'],'pilot-05-006/src2':['240','33','c'],
 'pilot-05-007/src240-39':['240','39'],
};
const comparisons={
 'pilot-04-001/src11':'전반감사전략과 세부 감사계획의 수립이 반드시 개별적·순차적일 필요는 없고 한쪽 변경이 다른 쪽에 영향을 주므로 밀접하다는 두 요구가 동일하다. 공백과 PDF 줄바꿈만 다르다.',
 'pilot-04-001/src14':'전체 중요성 및 해당되는 특정 항목 중요성을 최초보다 낮추는 것이 적합하다는 조건, 수행중요성 수정 필요 판단, 추가절차의 성격·시기·범위 적합성 판단을 그대로 보존한다. 공백·줄바꿈만 바뀐다.',
 'pilot-04-002/src1':'당기 시작단계의 계속 여부 절차·독립성 등 윤리 준수 평가·업무조건 이해라는 세 활동과 220/210 연결이 동일하다. 공식 각주 표지 1·2·3 및 PDF180→181 쪽머리를 추가 보존한다. 해당 각주가 별도 득점 요건으로 추가되지 않으며 종전 220 체계의 적용 가정을 유지한다.',
 'pilot-04-002/src2':'전반전략·감사계획 자체와 진행 중 중요한 변경 및 변경 이유의 문서화 범위가 동일하다. 공식 각주6만 본문대로 보존하며 문항의 독립 득점을 추가하거나 삭제하지 않는다.',
 'pilot-04-004/src1':'감사인의 적시 문서화 의무와 A1 참조가 동일하다. 공백·줄바꿈만 바뀐다.',
 'pilot-04-004/src2':'숙련된 비관여 감사인의 충분한 이해를 위한 절차 성격·시기·범위, 결과·증거, 유의사항·결론·유의적 판단의 범위가 동일하다. 공식 PDF72의 (a)는 도입부가 반복되어 있어 그대로 보존한다. 반복된 동일 문장은 새 요구나 추가 득점이 아니다.',
 'pilot-04-005/src1':'최종 취합 완료 후 보존기간 종료 전까지 어떠한 성격의 문서도 삭제·폐기 금지라는 주체·시점·범위가 동일하다. 외감법 괄호의 법정기한을 구체 연수로 바꾸지 않는다.',
 'pilot-04-005/src2':'중요성 금액과 그 결정 요소, 전체 중요성·해당되는 특정 항목 수준·수행중요성·감사 진행에 따른 수정의 네 범위를 보존한다. 공식 각주5 및 PDF307→308 쪽머리를 보존하며 새로운 금액 종류나 법적 판단을 만들지 않는다.',
 'pilot-05-001/src1':'지배기구 전원 경영 참여 예외, 경영진 연루 부정 의심, 적시 통보, 완료 필요 절차의 성격·시기·범위 토의, 법규상 금지 예외가 동일하다. 공백·하이픈 간격만 바뀐다.',
 'pilot-05-001/src6':'법규가 특정 커뮤니케이션을 제한할 수 있고 복잡한 이슈에서 법적 조언을 고려할 수 있다는 범위를 유지한다. 법적 자문을 항상 의무로 바꾸지 않으며 실제 국가의 금지 법규를 새로 판정하지 않는다.',
 'pilot-05-002/src1':'통제무력화 위험 평가와 무관한 계획·수행 및 분개 테스트의 질문·기말 추출·전체기간 테스트 필요 고려가 동일하다. 33 머리말부터 (a)까지의 기존 범위만 정확 발췌하며 (b)/(c)를 이 물음의 숨은 요구로 추가하지 않는다.',
 'pilot-05-002/src2':'편의 검토, 개별적으로 합리적이어도 편의 및 부정위험 평가, 편의 가능성 있으면 전반 재평가, 전기 유의 추정의 판단·가정 소급 재검토가 동일하다. (b)의 전체 범위만 유지한다.',
 'pilot-05-003/src1':'감사 중 식별된 유의적 내부통제 미비점, 지배기구·적시·서면이라는 대상·상대방·시점·형태가 동일하다. 학습자료의 Markdown 강조 **만 제거되어 공식 전사로 연결된다.',
 'pilot-05-003/src2':'내역과 잠재 영향, 재무제표 의견 목적, 통제 효과성 의견 목적 아님과 절차 설계를 위한 고려, 보고할 만큼 충분히 중요한 식별 미비점으로의 제한을 모두 보존한다. PDF170→171 쪽머리·줄바꿈만 추가된다.',
 'pilot-05-005/src1':'기존 인용과 같은 27의 첫 문장만 선택하여 수익인식 부정위험 가정과 위험 발생 유형·거래·경영진주장 평가를 보존한다. 전체 공식 문단의 뒤에는 문서화 교차참조 문단47이 있으나 이를 임의로 48로 고치지 않는다. 기존 별도 src3의 실제 48 문단과 구분하며 예외 문서화에 새 점수를 두지 않는다.',
 'pilot-05-005/src2':'부정 중요왜곡표시위험을 유의적 위험으로 취급하고 아직 미수행 부분이 있으면 통제 식별·설계 평가·실행 여부 결정을 한다는 범위를 유지한다. 공식 각주9 및 A32-A33 참조를 보존하며 운영효과성 테스트로 바꾸지 않는다.',
 'pilot-05-005/src3':'수익인식 부정위험 가정을 적용할 수 없다는 결론의 이유를 문서화하는 48의 실제 원문이다. 이 ref는 현재 requirement/criterion의 직접 채점요구 없이 보충 출처로만 유지한다. 27의 교차참조를 이유로 문단을 재번호화하지 않는다.',
 'pilot-05-006/src1':'전기재무제표에 반영된 유의적 회계추정치에 관한 경영진의 판단·가정 소급 재검토라는 (b)(ii)만 발췌한다. 현재년도 전체 추정 재평가를 이 물음에 추가하지 않는다.',
 'pilot-05-006/src2':'정상 사업과정 밖 거래 또는 이해·입수정보상 비경상적인 유의적 거래, 사업상 논리 또는 그 결여, 부정 재무보고 수행/자산횡령 은폐 목적 평가라는 대상·대안·조건이 동일하다. 형식적 적법성만으로 불충분한 판단은 기존 사례 적용 추론이며 공식에 같은 문장이 있다고 꾸미지 않는다.',
 'pilot-05-007/src240-39':'기존 미등록 fgi 발췌와 등록 delegated-n03의 39 머리말·(a)/(b)/(c)(i)/(ii)가 같은 공식 PDF90–91 원문임을 직접 대조했다. LF/CRLF와 PDF page/PAGE 표지만 달라지며 다음 절 제목 서면진술은 인용에서 제외한다. 해지 전 책임·보고 요구·법적 가능 조건과 해지 후 토의·보고 요구의 단계 구분, 주체·대상·내용은 그대로 유지한다.',
};
function locate(file,quote){const t=fs.readFileSync(file,'utf8'),at=t.indexOf(quote);if(at<0||t.indexOf(quote,at+1)>=0)throw Error('Quote missing/ambiguous: '+file);return {startLine:t.slice(0,at).split('\n').length,endLine:t.slice(0,at+quote.length).split('\n').length};}
function normalizedSlice(haystack,needle){let flat='',positions=[];for(let i=0;i<haystack.length;i++)if(!/\s/u.test(haystack[i])){flat+=haystack[i];positions.push(i);}const want=norm(needle),at=flat.indexOf(want);if(at<0||flat.indexOf(want,at+1)>=0)throw Error('Requirement exact normalization mapping failed');return haystack.slice(positions[at],positions[at+want.length-1]+1);}
const entries=[];
for(const row of rows){
 const key=row.set_id+'/'+row.source_ref_id,[number,paragraph,part]=map[key],standard='KGA '+number;
 const set=bank.find(s=>s.id===row.set_id),before=set.source_refs.find(r=>r.id===row.source_ref_id);
 if(before.file!==row.file||before.source_quote!==row.source_quote)throw Error('Inventory snapshot mismatch: '+key);
 let file=target,extract=stage.extracts.find(e=>e.standard===standard&&e.paragraph===paragraph),quote=extract?.quote,pages=extract?.pdf_pages;
 if(paragraph==='39'){
  const unit=catalog.units.find(u=>u.id==='src-4cd052b5b68ae2e2b6');if(unit?.authority!=='official_transcription')throw Error('Existing 240.39 not registered official');
  file=unit.file;quote=unit.quote.slice(0,unit.quote.indexOf('서면진술')).trimEnd();pages=[90,91];
 }else if(part==='a')quote=quote.slice(0,quote.indexOf('\r\n(b)')).trimEnd();
 else if(part==='b')quote=quote.slice(quote.indexOf('(b)'),quote.indexOf('\r\n \r\n11 감사기준서')).trimEnd();
 else if(part==='bii')quote=quote.slice(quote.indexOf('(ii)',quote.indexOf('(b)')),quote.indexOf('\r\n \r\n11 감사기준서')).trimEnd();
 else if(part==='c'){quote=quote.slice(quote.indexOf('(c)')).trimEnd();pages=[90,90];}
 else if(part==='first-sentence')quote=quote.slice(0,quote.indexOf('평가하여야 한다.')+'평가하여야 한다.'.length);
 if(part==='a'||part==='b'||part==='bii')pages=[89,89];
 if(!quote)throw Error('Empty official quote');
 const range=locate(file,quote),label=`${standard} 문단 ${paragraph}${part&&part!=='first-sentence'?'('+part+')':''}`;
 const span=`${label}; 공식 2025 전문 PDF ${pages[0]}${pages[1]!==pages[0]?'–'+pages[1]:''}쪽; ${file} L${range.startLine}–L${range.endLine}; 연속 실제 인용`;
 const after={...before,file,title:`공식 2025 전문 ${label} (PDF ${pages.join('–')}쪽)`,source_quote:quote,content_hash:sha(quote),source_span:span};
 const requirements=set.subquestions.flatMap(q=>q.requirements.filter(r=>r.source_ref_id===row.source_ref_id).map(r=>{
  const rq=paragraph==='39'?normalizedSlice(quote,r.source_quote):quote;const rl=locate(file,rq);
  return {subquestion_id:q.id,requirement_id:r.id,before:r,after:{...r,source_quote:rq,source_span:`${label}; 공식 2025 전문 PDF ${pages[0]}${pages[1]!==pages[0]?'–'+pages[1]:''}쪽; ${file} L${rl.startLine}–L${rl.endLine}; 기존 요구 범위의 공식 원문 직접 인용`}};
 }));
 let units=catalog.units.filter(u=>u.file===file&&u.authority==='official_transcription'&&u.standard===standard&&u.startLine<=range.endLine&&u.endLine>=range.startLine);
 if(paragraph==='39')units=units.filter(u=>u.id==='src-4cd052b5b68ae2e2b6');
 if(!units.length)throw Error('No registered overlapping unit: '+key);
 entries.push({set_id:row.set_id,source_ref_id:row.source_ref_id,before_source_ref:before,after_source_ref:after,requirements,catalog_unit_ids:units.map(u=>u.id),semantic_comparison:{judgment:'same_scoring_scope_after_official_text_comparison',reason:comparisons[key],subject_conditions_exceptions_preserved:true,claims_points_prompts_model_answers_unchanged:true,paragraph_source_range:range,catalog_mapping:units.map(u=>({id:u.id,standard:u.standard,paragraph:u.paragraph,range:[u.startLine,u.endLine],relation:u.startLine<=range.startLine&&u.endLine>=range.endLine?'contains_entire_selected_quote':'overlapping_actual_official_unit'})),limitations:'원문·배점 의미의 로컬 대조이며 실제 모델 의미검수·채점·사람 확인·게시 완료가 아님. 2027 시험 최종 판본은 기존 edition-policy의 별도 한계를 유지한다.'}});
}
if(entries.length!==20||entries.some(e=>!e.semantic_comparison.reason))throw Error('Missing review entry');
const proposal={version:1,bank_file:bankFile,bank_sha256:sha(bankBytes),entries,new_official_files:[{staged_file:stage.staged_file,target_file:stage.target_file,sha256:stage.sha256,provenance:{official_url:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06',pdf:stage.source_pdf,pdf_sha256:stage.pdf_sha256,extract:stage.source_file,extract_sha256:stage.source_sha256,exact_extraction_evidence:`${out}/stage-evidence.json`,independent_pdf_evidence:`${out}/pdf-comparison-evidence.json`,registration_evidence:`${D}/official-source-registration-c-v1.json`}}]};
fs.writeFileSync(`${out}/proposals.json`,JSON.stringify(proposal,null,2)+'\n');
console.log(JSON.stringify({file:`${out}/proposals.json`,sha256:sha(fs.readFileSync(`${out}/proposals.json`)),entries:entries.length,sets:new Set(entries.map(e=>e.set_id)).size,requirements:entries.reduce((n,e)=>n+e.requirements.length,0),catalog_ids:new Set(entries.flatMap(e=>e.catalog_unit_ids)).size,bank_sha256:proposal.bank_sha256},null,2));
