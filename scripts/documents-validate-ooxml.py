"""Validate native Office packages downloaded from the authenticated GAI API."""
import hashlib
import json
import posixpath
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

root = Path(__file__).resolve().parent.parent
examples = root / 'docs/implementacao-documentos-profissionais-2026-10-28/exemplos'
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
results = []
for file in sorted(examples.glob('*.docx')):
    with ZipFile(file) as package:
        assert package.testzip() is None, 'ZIP CRC failure'
        names = set(package.namelist())
        for name in names:
            if name.endswith(('.xml', '.rels')):
                xml = ET.fromstring(package.read(name))
                if name.endswith('.rels'):
                    for rel in xml:
                        assert rel.attrib.get('TargetMode') != 'External', 'External relationship'
                        base = '' if name == '_rels/.rels' else name.split('/_rels/')[0]
                        target = posixpath.normpath(posixpath.join(base, rel.attrib['Target']))
                        assert target in names, f'Missing relationship: {target}'
        document = ET.fromstring(package.read('word/document.xml'))
        assert len(document.findall('.//w:p', ns)) > 5
        assert document.findall('.//w:tbl', ns), 'Native tables missing'
        assert document.findall('.//w:tblHeader', ns), 'Repeated table headers missing'
        assert b'NUMPAGES' in package.read('word/footer1.xml')
        assert b'PAGE' in package.read('word/footer1.xml')
        assert not any(name.endswith(('.html', '.htm', '.bin')) for name in names)
        results.append({'file': file.name, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'xml_valid': True, 'zip_crc_valid': True, 'relationships_valid': True, 'native_tables': len(document.findall('.//w:tbl', ns)), 'native_paragraphs': len(document.findall('.//w:p', ns)), 'page_fields': True})
(examples.parent / 'ooxml-validacao.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False))
