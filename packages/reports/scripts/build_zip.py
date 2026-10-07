"""Build a portable report archive from manifest-registered files only."""
import json
import sys
import zipfile
from pathlib import Path

manifest_path, export_path, zip_path = map(Path, sys.argv[1:4])
manifest = json.loads(manifest_path.read_text())
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in ('index.html', 'report.pdf', 'manifest.json'):
        archive.write(export_path / name, name)
    included = set()
    for item in manifest['evidence']:
        if item.get('missing'):
            continue
        name = item['file']
        if name in included:
            continue
        included.add(name)
        if '/' in name or '\\' in name or name.startswith('.'):
            raise ValueError('Invalid registered asset name')
        archive.write(export_path / 'assets' / name, 'assets/' + name)
