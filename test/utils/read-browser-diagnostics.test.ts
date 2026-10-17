import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { readBrowserDiagnostics } from '../../src/utils/readBrowserDiagnostics';

let root = '';
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'harness-diagnostic-read-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const path = () => join(root, 'browser-errors.ndjson');

test('no diagnostics, including an empty file, makes no claim about browser monitoring', () => {
	expect(readBrowserDiagnostics(root)).toEqual({});
	writeFileSync(path(), '\n');
	expect(readBrowserDiagnostics(root)).toEqual({});
});

for (const content of ['{', JSON.stringify({ errors: [] }), 'x'.repeat(2_000_001)]) {
	test(`refuses malformed or oversized diagnostics (${content.length} bytes)`, () => {
		writeFileSync(path(), content);
		expect(readBrowserDiagnostics(root).failure).toMatch(/Browser diagnostics/);
		expect(readBrowserDiagnostics(root).browserErrors).toBeUndefined();
	});
}

test('does not follow a diagnostics file outside the run', () => {
	const outside = join(root, 'other');
	writeFileSync(outside, '[]');
	symlinkSync(outside, path());
	expect(readBrowserDiagnostics(root).failure).toMatch(/regular file/);
});
