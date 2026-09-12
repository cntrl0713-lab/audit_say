from pathlib import Path
import hashlib
import json

base = Path(__file__).resolve().parent
source = base / 'run-owned-semantic-after-credit.py'
target = base / 'run-owned-semantic-independent.py'
before = source.read_text(encoding='utf-8')
old = """            if transport_failure and result.get('error', {}).get('code') == 'transport':
                failed_sets.append(failure)
                event({'stage': 'set_incomplete_after_bounded_transport_resume', **failure})
                continue
"""
new = """            source_case_shape_failure = '전체 근거 인용 누락' in str(result.get('validation_error') or '')
            if (transport_failure and result.get('error', {}).get('code') == 'transport') or source_case_shape_failure:
                failed_sets.append(failure)
                event({'stage': 'set_incomplete_after_source_case_shape_failure' if source_case_shape_failure else 'set_incomplete_after_bounded_transport_resume', **failure})
                continue
"""
assert before.count(old) == 1
assert not target.exists()
after = before.replace(old, new)
compile(after, str(target), 'exec')
target.write_text(after, encoding='utf-8', newline='\n')
delta = {'source': source.name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
         'target': target.name, 'target_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
         'change': 'After the existing two model attempts fail the specific case-source citation validation, retain incomplete output and continue independent sets. Do not add another shape retry. Nested credit/quota stop and all hash guards remain unchanged.',
         'api_calls': 0}
(base / 'independent-controller-delta.json').write_text(json.dumps(delta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(delta, ensure_ascii=False))
