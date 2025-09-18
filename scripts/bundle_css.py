#!/usr/bin/env python3
"""Utility to bundle CSS modules into a single minified file."""
from __future__ import annotations

import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
CSS_DIR = BASE_DIR / 'assets' / 'css'
ENTRY_FILE = CSS_DIR / 'style.css'
OUTPUT_FILE = CSS_DIR / 'style.bundle.css'

IMPORT_PATTERN = re.compile(r"@import\s+['\"]([^'\"]+)['\"];?")


def _resolve_css(file_path: Path, seen: set[Path]) -> str:
    if file_path in seen:
        return ''

    seen.add(file_path)
    lines: list[str] = []

    for raw_line in file_path.read_text(encoding='utf-8').splitlines():
        stripped = raw_line.strip()
        match = IMPORT_PATTERN.match(stripped)
        if match:
            imported_path = (file_path.parent / match.group(1)).resolve()
            if imported_path.suffix == '.css':
                lines.append(_resolve_css(imported_path, seen))
            continue
        lines.append(raw_line)

    return '\n'.join(lines)


def _minify_css(css: str) -> str:
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{};:,>])\s*', r'\1', css)
    css = re.sub(r';}', '}', css)
    return css.strip()


def main() -> None:
    combined = _resolve_css(ENTRY_FILE.resolve(), set())
    minified = _minify_css(combined)
    OUTPUT_FILE.write_text(minified + '\n', encoding='utf-8')
    print(f'Wrote {OUTPUT_FILE.relative_to(BASE_DIR)}')


if __name__ == '__main__':
    main()
