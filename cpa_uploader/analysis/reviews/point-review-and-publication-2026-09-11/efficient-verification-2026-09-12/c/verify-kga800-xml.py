import json, hashlib, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
D=Path('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12')
A=D/'a/kga800-investigation'; O=D/'c/kga800-followup-v1';O.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
doc=A/'kga800-805-810-2020-1.docx';stage=A/'official-kga800-2020-stage.txt'
ev=json.loads((A/'transcription-evidence.json').read_text('utf-8'))
assert sha(doc.read_bytes())==ev['source_sha256'];assert sha(stage.read_bytes())==ev['stage_sha256']
with zipfile.ZipFile(doc) as z: xml=z.read('word/document.xml')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paras=[''.join(p.itertext()) for p in []] # Use w:t only, preserving run order.
paras=[''.join(t.text or '' for t in p.findall('.//w:t',ns)) for p in ET.fromstring(xml).findall('.//w:p',ns)]
saved=json.loads((A/'attachment-1-paragraphs.json').read_text('utf-8'))
# Recorded XMLP numbering is zero based and retains empty original XML paragraphs.
for p in saved: assert paras[p['xml_p_index']]==p['text']
text=stage.read_text('utf-8');checks=[]
for b in ev['blocks']:
 lo,hi=b['body_xml_p_range'];body='\n'.join(x for x in paras[lo:hi+1] if x.strip());
 assert sha(body.encode())==b['body_sha256'],b['paragraph']
 assert sha(b['transcription'].encode())==b['transcription_sha256']
 assert b['transcription'] in text
 expected=f"{b['paragraph']}. {body}";assert expected==b['transcription'],b['paragraph']
 checks.append({'paragraph':b['paragraph'],'xml_p_range':b['docx_xml_p_range'],'body_sha256':b['body_sha256'],'number_and_original_body_match':True})
out={'version':1,'reviewer':'agent','method':'Independent ZIP/XML extraction of original DOCX; every recorded nonempty XMLP row and all35 transcribed numbered blocks compared without inferred page numbers; empty XML paragraphs are excluded and nonempty text is unchanged.','docx':str(doc).replace('\\','/'),'docx_sha256':sha(doc.read_bytes()),'xml_sha256':sha(xml),'stage':str(stage).replace('\\','/'),'stage_sha256':sha(stage.read_bytes()),'recorded_xml_paragraphs':len(saved),'blocks':checks,'api_calls':0,'errors':[]}
(O/'xml-independent-check.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'paragraph_rows':len(saved),'blocks':len(checks),'errors':0}))
