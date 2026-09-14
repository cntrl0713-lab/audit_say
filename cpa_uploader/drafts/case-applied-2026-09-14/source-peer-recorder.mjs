import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import specs from './b/authoring-spec.mjs';
const D='cpa_uploader/drafts/case-applied-2026-09-14';
const raw='cpa_uploader/raw/originals/case-applied-2026-09-14';
const read=file=>JSON.parse(fs.readFileSync(file));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const provenance=read(raw+'/provenance.json');
for(const name of ['source','pdf','raw','registered'])assert.equal(ref(provenance[name].file).sha256,provenance[name].sha256);
assert.equal(ref(provenance.faq.file).sha256,provenance.faq.sha256);
const source=fs.readFileSync(provenance.source.file,'utf8');
const sourceLines=source.split(/(?<=\n)/u),registered=fs.readFileSync(provenance.registered.file,'utf8');
const fragments=provenance.fragments.map(fragment=>{
  const text=sourceLines.slice(fragment.start-1,fragment.end).join('');
  assert.equal(hash(text),fragment.fragment_sha256);assert(registered.includes(text));
  return {...fragment,actual_fragment_sha256:hash(text),registered_exact_fragment:true,bullet_count:(text.match(//gu)??[]).length};
});
assert.equal(fragments.find(f=>f.paragraph==='A16').bullet_count,11);
assert.deepEqual(fs.readFileSync(provenance.raw.file),fs.readFileSync(provenance.registered.file));
const catalog=read(D+'/source-catalog-final.json');
const selectedUnits=catalog.units.filter(unit=>unit.file===provenance.registered.file);
assert.equal(selectedUnits.length,2);assert.deepEqual(selectedUnits.map(u=>[u.paragraph,u.page]),[['A16',584],['A19',585]]);
for(const unit of selectedUnits)assert(registered.includes(unit.quote));
const faq=fs.readFileSync(provenance.faq.text_file,'utf8');
assert(faq.includes('회계감사기준의 일부가 아니고')&&faq.includes('승인을 받지 않아')&&faq.includes('해석으로서 효력이 없습니다'));
const case720=specs.find(spec=>spec.id==='case-16-other-information-cause-20260914');assert(case720);
const designSnapshot={id:case720.id,facts:case720.facts,exclusions:case720.exclusions,official:case720.official,questions:case720.questions.map(q=>({id:q.id,prompt:q.prompt,source_backed_claims:q.criteria.map(c=>({claim:c[0],source_unit_ids:[c[1],...(c[3]??[])]}))}))};
assert(case720.official.includes('src-ec497f319eccccaa60')&&case720.official.includes('src-61b7759438dd4828fe'));
const files=[raw+'/provenance.json',provenance.pdf.file,provenance.source.file,provenance.raw.file,provenance.registered.file,
  raw+'/kga570-page-0584.png',raw+'/kga570-page-0585.png',provenance.faq.file,provenance.faq.text_file,raw+'/faq-scope.png',raw+'/faq-fetch.json',
  D+'/source-catalog-final.json',D+'/b/sources/720-p836.png','cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt'];
const output={version:1,artifact_type:'independent_source_peer_review',reviewer_type:'agent',reviewer_id:'agent:/root/followup_sources_b',
  reviewed_at:new Date().toISOString(),method:'Independent visual PDF-page reading, direct pypdf reading of the original PDF, exact preserved-line comparison, and scoped design comparison.',
  human_review_performed:false,actual_model_api_calls:0,verdict:'pass',files:files.map(ref),
  official_pdf_page_count:1001,faq_pdf_page_count:15,
  visual_pages:[{file:provenance.pdf.file,pages:[584,585],image_files:[raw+'/kga570-page-0584.png',raw+'/kga570-page-0585.png']},{file:provenance.faq.file,pages:[2],image_files:[raw+'/faq-scope.png']},{file:provenance.pdf.file,pages:[836],image_files:[D+'/b/sources/720-p836.png']}],
  original_pdf_direct_reading:{tool:'pypdf.PdfReader with bundled Python -X utf8; originals opened read-only',official_pages:[584,585,838,839],faq_pages:[2],initial_output_issue:'첫 pypdf 출력이 Windows cp949에서 불릿을 출력하지 못하여 종료됐다. UTF-8 stdout으로 재실행했으며 원본 파일·추출 내용은 수정하지 않았다.'},
  registered_units:selectedUnits.map(u=>({id:u.id,paragraph:u.paragraph,page:u.page,start_line:u.startLine,end_line:u.endLine,quote_sha256:hash(u.quote)})),
  fragment_checks:fragments,
  checks:[
    {subject:'KGA570.A16',source_page:584,source_lines:[24659,24686],verdict:'pass',reason:'PDF584의 A16 시작문장과 11개 불릿 전체를 전사에 대조했다. 현금흐름·중간재무제표·차입약정·회의록·소송·금융지원·미처리주문·후속사건·차입수단·규제조치·자산처분의 항목이 모두 있고 각주 호출·소유 각주는 없다. 다음 A17과 A18은 별도 문단으로 잘 구분된다. 본문은 관련 절차에 포함될 수 있는 예시 목록이므로 모든 예시를 항상 수행할 의무로 확대해서는 안 된다.'},
    {subject:'KGA570.A19',source_page:585,source_lines:[24703,24706],verdict:'pass',reason:'PDF585 맨 위 A19 전부가 등록 전사와 일치한다. 제3자의 계속된 지원이 경영진 가정에 포함되고 계속기업 존속능력에 중요한 경우라는 조건, 계약조건을 포함한 서면조회 요청의 고려, 지원을 제공할 능력의 증거입수 필요성이 모두 보존된다. 지원 약정의 존재·조건과 실제 지원능력 증거는 별개의 확인점이며, 서면조회 요청 고려를 무조건적인 조회 의무로 바꾸지 않는다. A20의 경영진 서면진술은 별도 문단이다.'},
    {subject:'Transcription markers and source fidelity',verdict:'pass_with_documented_editorial_markers',reason:'원행 fragment는 줄바꿈·공백을 포함하여 바이트로 동일하고 raw/registered 파일도 동일하다. 전체 등록 파일에는 작성자 provenance·제목·PDF PAGE 위치표시가 추가되어 있으므로 전체 PDF 원문의 무변형 사본이 아니라 직접 문단 발췌 모음이다. 카탈로그 A16 인용 말미에 포함된 PDF PAGE 585는 다음 발췌의 위치 색인이며 A16 본문·별도 요구·A16의 실제 쪽수가 아니다. 문항 인용에서는 본문 fragment만 사용할 수 있다.'},
    {subject:'KGA720 FAQ authority',faq_page:2,faq_text_lines:[16,23],verdict:'pass',reason:'표제·발행주체와 2쪽 안내문을 원 PDF 및 보존 이미지에서 확인했다. 한국공인회계사회 감사인증기준본부의 참고자료이며 회계감사기준의 일부가 아니고 위원회의 승인을 받지 않아 기준 해석으로서 효력이 없다고 명시한다. 기준서·승인된 실무지침의 대체물 또는 신규 의무의 직접 근거로 취급하지 않는다.'},
    {subject:'KGA720 application date',source_page:836,source_lines:[34584,34598],verdict:'pass',reason:'병합 셀을 포함한 실제 시행일 표를 확인했다. 직전 사업연도말 자산 5천억원 이상인 주권상장법인은 2026년 1월 1일 이후 개시 보고기간 감사부터 적용한다. 검토한 설계는 2025년말 자산 8천억원의 주권상장법인에 대한 2026년 감사이므로 이 범위에 들어간다. 비상장법인의 2027 적용행을 2026에 잘못 대입하지 않았다.'},
    {subject:'KGA720 FAQ and scoped case design',source_pages:[838,839],source_lines:[[34674,34684],[34720,34723]],supplemental_context_lines:[35246,35255],verdict:'pass',reason:'720.16은 불일치가 보이는 단계에서 경영진과 논의하고 필요한 경우 기타정보 오류·재무제표 오류·기업이해 갱신 필요성을 판단하는 절차를 요구한다. 720.20은 재무제표 오류나 기업이해 갱신으로 결론 난 경우 관련 감사기준서에 따른 대응을 요구한다. 현재 설계의 위탁상품 설명/발송일 매출 원인조사, 확인된 미수정 재무제표 오류의705 대응, 공장 가동중단에 따른315/330 대응은 이 분기를 보존한다. FAQ를 근거로 기타정보 자체에 감사확신을 부과하거나 모든 기타정보에 별도 입증절차를 요구하지 않으며, 기타정보만의 오류를 재무제표 의견변형으로 자동 전환하지 않는다. 직접 정답 근거는 기준서에 연결되어 있고 FAQ 비권위성 안내와 충돌하지 않는다.'}
  ],
  design_observation:{working_copy_file:D+'/b/authoring-spec.mjs',observed_file_sha256:ref(D+'/b/authoring-spec.mjs').sha256,reviewed_snapshot:designSnapshot,reviewed_snapshot_sha256:hash(JSON.stringify(designSnapshot)),final_content_review_required:true,note:'원자료의 권위·판본·설계 방향에 관한 한정된 출처 peer이다. 작성 중 전체 QA나 최종 문항의 검수·채점 통과를 선언하지 않는다. 이후 문항 검토는 root/작성자 peer의 최종 내용 해시에 결속한다.'},
  unresolved_source_findings:[],original_files_changed:[],source_accuracy_error_tolerance:0};
for(const identity of output.files)assert.equal(ref(identity.file).sha256,identity.sha256);
fs.writeFileSync(D+'/source-peer-review.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log({file:D+'/source-peer-review.json',sha256:ref(D+'/source-peer-review.json').sha256,verdict:output.verdict,checks:output.checks.length,unresolved:0,raw_writes:0});
