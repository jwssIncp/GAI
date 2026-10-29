"""Read-only QA of artifacts emitted by the application's native renderer."""
import hashlib
import json
import posixpath
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

import pdfplumber
from PIL import Image, ImageDraw

folder = Path(sys.argv[1]).resolve()
output = folder / 'render-qa'
output.mkdir(exist_ok=True)
runtime = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies'
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
results = []
proof = json.loads((folder / 'report-volume.json').read_text(encoding='utf-8'))
proof_formats = {entry['format']: entry for entry in proof if 'format' in entry}
snapshot_file = folder / 'volume-2500-approved.snapshot.json'
snapshot = json.loads(snapshot_file.read_text(encoding='utf-8')) if snapshot_file.exists() else None
for file in sorted(folder.glob('volume-*.docx')):
    assert proof_formats['docx']['status'] == 201, 'Current DOCX generation did not succeed; do not inspect a stale file'
    with ZipFile(file) as package:
        assert package.testzip() is None
        names = set(package.namelist())
        for name in names:
            if name.endswith(('.xml', '.rels')):
                element = ET.fromstring(package.read(name))
                if name.endswith('.rels'):
                    for rel in element:
                        assert rel.attrib.get('TargetMode') != 'External'
                        base = '' if name == '_rels/.rels' else name.split('/_rels/')[0]
                        assert posixpath.normpath(posixpath.join(base, rel.attrib['Target'])) in names
        xml = ET.fromstring(package.read('word/document.xml'))
        text = ' '.join(xml.itertext())
        numbers = re.findall(r'SINTETICO item (\d{5})', text)
        assert numbers == [str(i).zfill(5) for i in range(2500)]
        assert xml.findall('.//w:tbl', ns) and xml.findall('.//w:tblHeader', ns)
        footer = package.read('word/footer1.xml')
        assert b'NUMPAGES' in footer and b'PAGE' in footer
        assert 'novo mestre' not in text
        assert proof_formats['docx']['snapshot_hash'] in text
        if snapshot:
            assert snapshot['hash'] == proof_formats['docx']['snapshot_hash']
            inventory = next(table for table in snapshot['data']['sources']['tables'] if table['family'] == 'inventory')
            cell_text = lambda cell: ''.join(cell.itertext())
            candidates = xml.findall('.//w:tbl', ns)
            native_table = next(table for table in candidates if [cell_text(cell) for cell in table.findall('w:tr', ns)[0].findall('w:tc', ns)] == inventory['columns'])
            native_rows = [[cell_text(cell) for cell in row.findall('w:tc', ns)] for row in native_table.findall('w:tr', ns)[1:]]
            expected_rows = [['Não informado' if value is None else str(value) for value in row] for row in inventory['rows']]
            assert native_rows == expected_rows, 'DOCX cells differ from the approved snapshot'
        results.append({'file': file.name, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'zip_crc': True, 'xml_and_relationships_valid': True, 'native_rows_in_order': len(numbers), 'page_fields': True, 'word_pagination_certified': False, 'approved_snapshot_cells_equal': bool(snapshot), 'approved_snapshot_hash': snapshot['hash'] if snapshot else None})
for file in sorted(folder.glob('volume-*.pdf')):
    assert proof_formats['pdf']['status'] == 201, 'Current PDF generation did not succeed; do not inspect a stale file'
    text = []
    outside = []
    with pdfplumber.open(file) as pdf:
        pages = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text.append(page.extract_text() or '')
            for char in page.chars:
                if char['text'].strip() and (char['x0'] < 20 or char['x1'] > page.width - 20 or char['top'] < 10 or char['bottom'] > page.height - 10):
                    outside.append({'page': i + 1, 'text': char['text'], 'x0': char['x0'], 'x1': char['x1'], 'top': char['top'], 'bottom': char['bottom']})
            page.close()
        assert not outside, outside[:10]
    combined = '\n'.join(text)
    tokens = set(re.findall(r'(?<!\d)\d{5}(?!\d)', combined))
    missing = sorted(set(str(i).zfill(5) for i in range(2500)) - tokens)
    assert not missing, missing[:10]
    assert 'novo mestre' not in combined
    assert proof_formats['pdf']['snapshot_hash'] in combined
    (output / 'pdf-text.txt').write_text(combined, encoding='utf-8')
    prefix = output / 'page'
    result = subprocess.run([str(runtime / 'native/poppler/Library/bin/pdftoppm.exe'), '-r', '72', '-png', str(file), str(prefix)], capture_output=True, text=True)
    (output / 'poppler.log').write_text(result.stdout + result.stderr, encoding='utf-8')
    assert result.returncode == 0
    images = sorted(output.glob('page-*.png'))
    assert len(images) == pages
    for offset in range(0, len(images), 25):
        sheet = Image.new('RGB', (850, 1200), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, image in enumerate(images[offset:offset + 25]):
            thumb = Image.open(image).convert('RGB')
            thumb.thumbnail((160, 215))
            x, y = (index % 5) * 170, (index // 5) * 240
            sheet.paste(thumb, (x, y + 20)); draw.text((x + 5, y), image.stem, fill='black')
        sheet.save(output / f'contact-{offset // 25 + 1}.png')
    results.append({'file': file.name, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'pages': pages, 'all_pages_rendered': True, 'all_2500_row_markers_present': True, 'outside_margin_characters': len(outside), 'visual_review': 'pending'})
(output / 'inspection.json').write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False))
