"""Read-only content/checksum checks for every accepted native export volume."""
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

import pdfplumber

folder = Path(sys.argv[1]).resolve()
records = json.loads((folder / 'volume-exports.json').read_text(encoding='utf-8'))
assert len(records) == 14
results = []
for record in records:
    count, kind = record['count'], record['format']
    if record['status'] != 201:
        assert count == 5000 and record['status'] == 503 and record['partial_artifact'] is False
        results.append({'count': count, 'format': kind, 'explicit_failure_without_artifact': True})
        continue
    file = folder / (f'volume-2500.{kind}' if count == 2500 else f'volume-matrix/volume-{count}.{kind}')
    assert hashlib.sha256(file.read_bytes()).hexdigest() == record['checksum']
    if kind == 'docx':
        with ZipFile(file) as package:
            assert package.testzip() is None
            text = ' '.join(ET.fromstring(package.read('word/document.xml')).itertext())
        markers = re.findall(r'SINTETICO item (\d{5})', text)
    else:
        parts = []
        with pdfplumber.open(file) as pdf:
            assert len(pdf.pages) == record['pages']
            for page in pdf.pages:
                parts.append(page.extract_text() or '')
                page.close()
        text = '\n'.join(parts)
        # The narrow description column may wrap; five-digit identifiers remain intact.
        markers = re.findall(r'(?<!\d)(\d{5})(?!\d)', text)
        markers = [value for value in markers if int(value) < count]
    assert markers == [str(i).zfill(5) for i in range(count)], (count, kind, len(markers))
    assert record['snapshot_hash'] in text
    results.append({'count': count, 'format': kind, 'checksum_valid': True, 'all_rows_in_order_no_duplicates': True, 'snapshot_hash_present': True})
(folder / 'matrix-content-inspection.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps({'accepted_files_verified': sum(item['status'] == 201 for item in records), 'explicit_failures': sum(item['status'] == 503 for item in records)}))
