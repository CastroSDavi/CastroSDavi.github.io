#!/usr/bin/env python3
"""Utility to bundle CSS modules into a single minified file."""
from __future__ import annotations

import argparse
import logging
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Sequence

BASE_DIR = Path(__file__).resolve().parents[1]
CSS_DIR = (BASE_DIR / 'assets' / 'css').resolve()
ENTRY_FILE = CSS_DIR / 'style.css'
OUTPUT_FILE = CSS_DIR / 'style.bundle.css'

IMPORT_PATTERN = re.compile(r"@import\s+['\"]([^'\"]+)['\"];?")

LOGGER = logging.getLogger(__name__)
WATCH_DIRECTORIES: List[Path] = [CSS_DIR]


def _ensure_watch_directories(extra_dirs: Optional[Sequence[Path]]) -> None:
    if not extra_dirs:
        return

    for candidate in extra_dirs:
        resolved = candidate.resolve()
        if resolved.is_file():
            resolved = resolved.parent
        if resolved not in WATCH_DIRECTORIES:
            WATCH_DIRECTORIES.append(resolved)


def _resolve_css(file_path: Path, seen: set[Path]) -> str:
    if file_path in seen:
        return ''

    seen.add(file_path)
    lines: List[str] = []

    try:
        source = file_path.read_text(encoding='utf-8')
    except FileNotFoundError as exc:  # pragma: no cover - defensive
        raise RuntimeError(f'CSS file not found: {file_path}') from exc

    for raw_line in source.splitlines():
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


def _bundle_once(quiet: bool = False) -> bool:
    combined = _resolve_css(ENTRY_FILE.resolve(), set())
    minified = _minify_css(combined)
    new_content = minified + '\n'

    previous_content = OUTPUT_FILE.read_text(encoding='utf-8') if OUTPUT_FILE.exists() else ''
    if previous_content == new_content:
        if not quiet:
            rel_path = OUTPUT_FILE.relative_to(BASE_DIR)
            print(f'{rel_path} already up to date.')
        LOGGER.debug('CSS bundle already up to date.')
        return False

    OUTPUT_FILE.write_text(new_content, encoding='utf-8')
    if not quiet:
        rel_path = OUTPUT_FILE.relative_to(BASE_DIR)
        print(f'Wrote {rel_path} ({len(minified)} bytes)')
    LOGGER.info('Regenerated CSS bundle (%d bytes).', len(minified))
    return True


def _snapshot_css() -> Dict[Path, tuple[int, int]]:
    snapshot: Dict[Path, tuple[int, int]] = {}
    output_path = OUTPUT_FILE.resolve()

    for root in WATCH_DIRECTORIES:
        if not root.exists():
            continue
        for css_file in root.rglob('*.css'):
            css_path = css_file.resolve()
            if css_path == output_path:
                continue
            try:
                stat = css_path.stat()
            except FileNotFoundError:
                continue
            snapshot[css_path] = (stat.st_mtime_ns, stat.st_size)
    return snapshot


def _watch(interval: float, quiet: bool) -> None:
    if not quiet:
        print('Watching for CSS changes... Press Ctrl+C to stop.')

    _bundle_once(quiet=quiet)
    previous_snapshot = _snapshot_css()

    try:
        while True:
            time.sleep(interval)
            current_snapshot = _snapshot_css()
            if current_snapshot != previous_snapshot:
                if not quiet:
                    print('Change detected. Rebuilding bundle...')
                try:
                    _bundle_once(quiet=quiet)
                except Exception:
                    LOGGER.exception('Failed to rebuild CSS bundle.')
                previous_snapshot = current_snapshot
    except KeyboardInterrupt:
        if not quiet:
            print('\nStopping watcher.')


def watch(interval: float = 1.0, quiet: bool = False, extra_dirs: Optional[Sequence[Path]] = None) -> None:
    """Public helper that keeps the watcher running forever."""
    _ensure_watch_directories(extra_dirs)
    _watch(interval=interval, quiet=quiet)


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Bundles style.css imports into style.bundle.css.')
    parser.add_argument('--watch', action='store_true', help='Keep watching CSS files and rebuild on change.')
    parser.add_argument('--interval', type=float, default=1.0, help='Polling interval in seconds when watching (default: 1.0).')
    parser.add_argument('--quiet', action='store_true', help='Suppress informational output.')
    parser.add_argument('--include', action='append', type=Path, help='Additional directories to watch for .css changes.')
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)

    if not ENTRY_FILE.exists():
        print(f'Erro: arquivo de entrada {ENTRY_FILE} nao encontrado.', file=sys.stderr)
        return 1

    _ensure_watch_directories(args.include)

    if args.watch:
        watch(interval=args.interval, quiet=args.quiet)
    else:
        _bundle_once(quiet=args.quiet)

    return 0


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    sys.exit(main())
