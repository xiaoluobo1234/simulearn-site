from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
LAB = ROOT / 'public/downloads/python-lab'
PROJECT = ROOT / 'public/downloads/csv-checker'

def digest(data):
    return hashlib.sha256(data).hexdigest()

reference = json.loads((LAB / 'runtime-check.json').read_text(encoding='utf-8-sig'))
for check in reference['checks']:
    if digest((LAB / check['code']).read_bytes()) != check['codeSha256'] or digest((LAB / check['input']).read_bytes()) != check['inputSha256']:
        raise RuntimeError('Reference is stale; run node scripts/check-python-lab.mjs first')
for check in reference['csvProjectChecks']:
    if digest((LAB / 'csv_check.py').read_bytes()) != check['codeSha256'] or digest((PROJECT / check['input']).read_bytes()) != check['inputSha256']:
        raise RuntimeError('CSV project reference is stale; rerun the actual interpreter')

def package(directory, archive_name, members):
    data = {name: source.read_bytes() for name, source in members.items()}
    manifest = ''.join(f'{digest(content)}  {name}\n' for name, content in sorted(data.items())).encode('ascii')
    data['PACKAGE-SHA256SUMS.txt'] = manifest
    with zipfile.ZipFile(directory / archive_name, 'w') as archive:
        for name, content in sorted(data.items()):
            # Reproducible container timestamp; actual execution time is in runtime-check.json.
            entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content)
    with zipfile.ZipFile(directory / archive_name) as archive:
        if archive.testzip() is not None or any(archive.read(name) != content for name, content in data.items()):
            raise RuntimeError('Generated archive failed byte verification')
    files = sorted(item for item in directory.iterdir() if item.is_file() and item.name != 'SHA256SUMS.txt')
    (directory / 'SHA256SUMS.txt').write_bytes(''.join(f'{digest(item.read_bytes())}  {item.name}\n' for item in files).encode('ascii'))
    print(f'{archive_name}: {len(data)} verified members; {len(files)} published files')

package(LAB, 'python-lab.zip', {name: LAB / name for name in ['README.md', 'csv_check.py', 'sample.csv', 'axial_bar.py', 'bar-input.json', 'runtime-check.json']})
package(PROJECT, 'csv-checker.zip', {**{name: PROJECT / name for name in ['README.md', 'normal.csv', 'missing-field.csv', 'non-numeric.csv', 'missing-unit.csv']}, 'csv_check.py': LAB / 'csv_check.py', 'runtime-check.json': LAB / 'runtime-check.json'})
