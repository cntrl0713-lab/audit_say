import json, re, hashlib
from pathlib import Path

base = Path(__file__).parent
rows = json.loads((base / 'input-11-14.json').read_text(encoding='utf-8-sig'))
normalize = lambda s: re.sub(r'\s+', '', s)
cache = {}
out = []
for row in rows:
    checks = []
    for ref in row['source_refs']:
        path = Path(ref['file'])
        if str(path) not in cache:
            raw = path.read_bytes()
            body = raw.decode('utf-8-sig')
            cache[str(path)] = (body, normalize(body), hashlib.sha256(raw).hexdigest())
        body, norm, sha = cache[str(path)]
        quote = ref.get('source_quote', '')
        checks.append({'id':ref['id'],'file':ref['file'],'span':ref['title'], 'file_sha256':sha,
                       'source_quote_sha256':hashlib.sha256(quote.encode()).hexdigest(),
                       'exact_match':quote in body, 'whitespace_normalized_match':bool(quote) and normalize(quote) in norm})
    out.append({'key': row['key'], 'checks': checks})
(base / 'source-checks-11-14.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'rows':len(out),'files':len(cache),'references':sum(len(x['checks']) for x in out),
                  'missing':[{ 'key':x['key'], 'ref':c['id'], 'file':c['file']} for x in out for c in x['checks'] if not c['whitespace_normalized_match']]},ensure_ascii=False,indent=2))
