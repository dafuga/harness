import { test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { readBrowserDiagnostics } from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/readBrowserDiagnostics';

const FILE = 'browser-errors.ndjson';
const NOT_REGULAR = 'Browser diagnostics must be a regular file of at most 2000000 bytes.';
const UNREADABLE = 'Browser diagnostics could not be read or did not match their schema.';
const LIMIT = 2_000_000;

const pageError = {
	test: 'verification page loads',
	file: 'tests/e2e/verification.spec.ts',
	project: 'chromium',
	retry: 0,
	errors: [
		{
			type: 'pageerror',
			message: 'TypeError: Cannot read properties of undefined',
			page: 'http://127.0.0.1:4173/verify'
		}
	],
	expected: []
};
const expectedConsole = {
	test: 'fixture logo is intentionally absent',
	file: 'tests/e2e/console.spec.ts',
	project: 'chromium',
	retry: 1,
	browser: 'chromium',
	errors: [
		{
			type: 'console',
			message: 'Failed to load resource',
			page: 'http://127.0.0.1:4173/',
			line: 0,
			column: 0
		}
	],
	expected: [
		{
			type: 'console',
			message: 'Failed to load resource',
			reason: 'Logo is intentionally absent in fixture'
		}
	]
};

/** Runs one case in a fresh directory owned by this test and removes it afterwards. */
function withDirectory<T>(run: (directory: string) => T): T {
	const directory = mkdtempSync(join(tmpdir(), 'read-browser-diagnostics-'));
	try {
		return run(directory);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

function writeDiagnostics(directory: string, content: string): void {
	writeFileSync(join(directory, FILE), content, 'utf8');
}

function record(state: string, cases: Parameters<typeof recordExampleCases>[1]): void {
	recordExampleCases(
		{
			unitId: 'function.read-browser-diagnostics',
			symbol: 'readBrowserDiagnostics',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Returns an empty result when the file is absent or blank', () => {
	const absent = withDirectory((directory) => readBrowserDiagnostics(directory));
	const empty = withDirectory((directory) => {
		writeDiagnostics(directory, '');
		return readBrowserDiagnostics(directory);
	});
	const blank = withDirectory((directory) => {
		writeDiagnostics(directory, '\n   \n\t\n');
		return readBrowserDiagnostics(directory);
	});
	expect(absent).toEqual({});
	expect(empty).toEqual({});
	expect(blank).toEqual({});
	record('returns-an-empty-result-when-the-file-is-absent-or-blank', [
		{ name: 'directory without browser-errors.ndjson', input: { file: 'absent' }, output: absent },
		{ name: 'zero-byte browser-errors.ndjson', input: { file: '' }, output: empty },
		{ name: 'whitespace-only browser-errors.ndjson', input: { file: '\n   \n\t\n' }, output: blank }
	]);
});

test('Parses each nonblank diagnostic line in order', () => {
	const content = `${JSON.stringify(pageError)}\n\n   \n${JSON.stringify(expectedConsole)}\n`;
	const output = withDirectory((directory) => {
		writeDiagnostics(directory, content);
		return readBrowserDiagnostics(directory);
	});
	expect(output).toEqual({ browserErrors: [pageError, expectedConsole] });
	record('parses-each-nonblank-diagnostic-line-in-order', [
		{
			name: 'two records separated by blank lines',
			input: { lines: [pageError, expectedConsole] },
			output
		}
	]);
});

test('Returns a failure for a nonregular or symlinked entry', () => {
	const directoryEntry = withDirectory((directory) => {
		mkdirSync(join(directory, FILE));
		return readBrowserDiagnostics(directory);
	});
	const symlinked = withDirectory((directory) => {
		const target = join(directory, 'target.ndjson');
		writeFileSync(target, `${JSON.stringify(pageError)}\n`, 'utf8');
		symlinkSync(target, join(directory, FILE));
		return readBrowserDiagnostics(directory);
	});
	expect(directoryEntry).toEqual({ failure: NOT_REGULAR });
	expect(symlinked).toEqual({ failure: NOT_REGULAR });
	record('returns-a-failure-for-a-nonregular-or-symlinked-entry', [
		{
			name: 'browser-errors.ndjson is a directory',
			input: { entry: 'directory' },
			output: directoryEntry
		},
		{
			name: 'browser-errors.ndjson is a symlink to a valid file',
			input: { entry: 'symlink' },
			output: symlinked
		}
	]);
});

test('Enforces the 2000000 byte limit exactly', () => {
	const line = `${JSON.stringify(pageError)}\n`;
	const atLimit = withDirectory((directory) => {
		writeDiagnostics(directory, line + ' '.repeat(LIMIT - Buffer.byteLength(line)));
		return readBrowserDiagnostics(directory);
	});
	const overLimit = withDirectory((directory) => {
		writeDiagnostics(directory, line + ' '.repeat(LIMIT - Buffer.byteLength(line) + 1));
		return readBrowserDiagnostics(directory);
	});
	expect(atLimit).toEqual({ browserErrors: [pageError] });
	expect(overLimit).toEqual({ failure: NOT_REGULAR });
	record('enforces-the-2000000-byte-limit-exactly', [
		{ name: 'file of exactly 2000000 bytes', input: { bytes: LIMIT }, output: atLimit },
		{ name: 'file of 2000001 bytes', input: { bytes: LIMIT + 1 }, output: overLimit }
	]);
});

test('Returns a failure without partial records', () => {
	const invalidJson = withDirectory((directory) => {
		writeDiagnostics(directory, `${JSON.stringify(pageError)}\n{"test":\n`);
		return readBrowserDiagnostics(directory);
	});
	const schemaViolation = withDirectory((directory) => {
		writeDiagnostics(
			directory,
			`${JSON.stringify(pageError)}\n${JSON.stringify({ ...expectedConsole, extra: true })}\n`
		);
		return readBrowserDiagnostics(directory);
	});
	expect(invalidJson).toEqual({ failure: UNREADABLE });
	expect(schemaViolation).toEqual({ failure: UNREADABLE });
	expect(invalidJson).not.toHaveProperty('browserErrors');
	expect(schemaViolation).not.toHaveProperty('browserErrors');
	record('returns-a-failure-without-partial-records', [
		{
			name: 'valid record followed by malformed JSON',
			input: { lines: [pageError, '{"test":'] },
			output: invalidJson
		},
		{
			name: 'valid record followed by a record with an unknown key',
			input: { lines: [pageError, { ...expectedConsole, extra: true }] },
			output: schemaViolation
		}
	]);
});
