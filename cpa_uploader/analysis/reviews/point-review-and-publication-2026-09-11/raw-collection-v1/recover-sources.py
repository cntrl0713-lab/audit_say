import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import urllib.request

root = pathlib.Path.cwd()
out = root / 'cpa_uploader/raw/originals/recovered-official-2026-09-11'
out.mkdir(parents=True, exist_ok=True)
record_path = 'cpa_uploader/analysis/reviews/question-review-2027/grading-cases/19-sources.json'
records = json.loads((root / record_path).read_text(encoding='utf-8'))
selected = [record for record in records if record.get('file', '').endswith(('framework.pdf', 'review.docx', 'aup.pdf', 'isae3000.pdf'))]

def retrieve(record):
    name = pathlib.PurePosixPath(record['file']).name
    result = {'historical_path': record['file'], 'url': record['url'], 'expected_sha256': record['sha256'],
              'historical_record': record_path, 'retrieved_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    try:
        request = urllib.request.Request(record['url'], headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=25) as response:
            data = response.read()
            result.update(http_status=response.status, content_type=response.headers.get('Content-Type'), final_url=response.url)
        digest = hashlib.sha256(data).hexdigest()
        result.update(bytes=len(data), sha256=digest)
        if digest == record['sha256']:
            result['status'] = 'historical_bytes_recovered'
            target = out / name
        else:
            result['status'] = 'different_bytes_not_accepted_as_historical_source'
            target = out / (name + '.response')
        with target.open('xb') as stream:
            stream.write(data)
        result['saved_path'] = target.relative_to(root).as_posix()
    except Exception as error:
        result.update(status='retrieval_failed', error=str(error))
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    results = list(executor.map(retrieve, selected))
report = {'version': 1, 'api_grading_calls': 0, 'entries': results}
target = pathlib.Path(__file__).with_name('recovery.json')
with target.open('x', encoding='utf-8') as stream:
    json.dump(report, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps([{'path': row['historical_path'], 'status': row['status']} for row in results], ensure_ascii=False))
