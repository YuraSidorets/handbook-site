#!/usr/bin/env python3
"""Verify and unpack the exact approved static website using only Python stdlib."""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import zipfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    p = PurePosixPath(name)
    if not name or '\\' in name or p.is_absolute() or any(x in ('', '.', '..') for x in name.split('/')):
        raise ValueError(f'Unsafe archive path: {name!r}')
    return p


def reassemble(root, output):
    root = root.resolve()
    output = output.resolve()
    manifest = json.loads((root / '.publication/package.json').read_text())
    if manifest['schema'] != 2 or manifest['site_url'] != 'https://handbook.sydorets.com/':
        raise ValueError('Unexpected package schema or site URL')
    if output == root or root in output.parents:
        raise ValueError('Extract outside the repository checkout')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output directory must be empty')
    cname = (root / 'CNAME').read_bytes()
    if cname.decode('utf-8').strip() != 'handbook.sydorets.com':
        raise ValueError('CNAME does not match the approved domain')
    chunks = []
    for index, part in enumerate(manifest['parts']):
        expected = f'.publication/parts/site.zip.part-{index:03d}'
        if part['path'] != expected or not 0 < part['size'] <= 200000:
            raise ValueError('Unexpected part name, order, or size')
        path = root / expected
        if path.is_symlink() or path.stat().st_size != part['size']:
            raise ValueError(f'Invalid part: {expected}')
        data = path.read_bytes()
        if digest(data) != part['sha256']:
            raise ValueError(f'Part checksum mismatch: {expected}')
        chunks.append(data)
    archive = b''.join(chunks)
    if len(archive) != manifest['archive']['size'] or digest(archive) != manifest['archive']['sha256']:
        raise ValueError('Archive checksum or length mismatch')
    allowed = manifest['files']
    for name in allowed:
        safe_name(name)
    if sum(row['size'] for row in allowed.values()) > 50000000:
        raise ValueError('Unpacked size exceeds package limit')
    # Validate every member before writing any output.
    checked = {}
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        for entry in z.infolist():
            name = entry.filename
            safe_name(name)
            mode = entry.external_attr >> 16
            if entry.is_dir() or stat.S_ISLNK(mode) or name in checked:
                raise ValueError(f'Unsupported or duplicate member: {name}')
            if name not in allowed or entry.file_size != allowed[name]['size']:
                raise ValueError(f'Unexpected member or length: {name}')
            data = z.read(entry)
            if digest(data) != allowed[name]['sha256']:
                raise ValueError(f'Member checksum mismatch: {name}')
            checked[name] = data
    if set(checked) != set(allowed) or 'CNAME' in checked:
        raise ValueError('Incomplete allowlist or packaged CNAME')
    # One explicit, integrity-checked renderer fix overlays the verified base.
    overrides = manifest.get('overrides', [])
    if len(overrides) != 1:
        raise ValueError('Exactly one renderer override is required')
    override = overrides[0]
    target = 'assets/diagrams.mjs'
    source = '.publication/overrides/' + target
    if override['target'] != target or override['path'] != source:
        raise ValueError('Unexpected override target or path')
    if override['base_sha256'] != digest(checked[target]):
        raise ValueError('Override base checksum mismatch')
    override_path = root / source
    if override_path.is_symlink() or not override_path.resolve().is_relative_to(root):
        raise ValueError('Unsafe override file')
    data = override_path.read_bytes()
    if len(data) != override['size'] or digest(data) != override['sha256']:
        raise ValueError('Override checksum or length mismatch')
    checked[target] = data
    output.mkdir(parents=True, exist_ok=True)
    for name, data in checked.items():
        path = output / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    (output / 'CNAME').write_bytes(cname)
    print(f'Verified {len(checked)} base files, applied one checked renderer override, and preserved the user-managed CNAME.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    reassemble(args.root, args.output)
