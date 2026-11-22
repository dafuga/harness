import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import type { GatherResult } from '../../src/utils/verification-evidence/gatherCaptures';
import { gatherCaptures } from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/gatherCaptures';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const recordPath =
	'evidence/9b1f0c6e4a2d7835f1c0e9b6a4d2f7c81e3a5b90/checks/tests-unit-format-bytes.test.ts';
const benchmarkFile = 'benchmark-reports.component.evidence-grid.json';
const benchmarkBody = JSON.stringify({
	measurements: [
		{
			unit: 'reports.component.evidence-grid',
			metric: 'render-time',
			unitOfMeasure: 'ms',
			value: 12.4,
			method: 'median of 30 renders',
			workload: null
		}
	]
});
const benchmarkLine = {
	evidence: 'benchmark',
	kind: 'benchmark',
	state: 'default',
	file: benchmarkFile,
	mediaType: 'application/json'
};
const emptyLine = {
	evidence: 'reports.component.evidence-grid',
	kind: 'screenshot',
	state: 'empty',
	viewport: 'desktop',
	file: 'evidence-grid-empty.png',
	mediaType: 'image/png'
};

function metaFor(state: string) {
	return {
		unitId: 'function.gather-captures',
		symbol: 'gatherCaptures',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function writeIndex(directory: string, lines: unknown[]): void {
	const text = lines.map((line) => JSON.stringify(line)).join('\n');
	writeFileSync(join(directory, 'captures.ndjson'), `${text}\n`);
}

function summarize(result: GatherResult): { gathered: unknown[]; failures: string[] } {
	return {
		gathered: result.gathered.map((item) => ({
			file: item.line.file,
			path: item.capture.path,
			bytes: item.capture.bytes,
			mediaType: item.capture.mediaType,
			hasBenchmark: item.benchmark !== undefined
		})),
		failures: result.failures
	};
}

test('Gathers a declared benchmark file into a record-ready entry', async () => {
	await withTempDir('gather-benchmark-', (directory) => {
		mkdirSync(join(directory, 'nested'), { recursive: true });
		writeFileSync(join(directory, benchmarkFile), benchmarkBody);
		writeIndex(directory, [benchmarkLine]);
		const result = gatherCaptures(directory, recordPath);
		expect(result.failures).toEqual([]);
		expect(result.gathered).toHaveLength(1);
		expect(result.gathered[0]?.capture.path).toBe(`${recordPath}/${benchmarkFile}`);
		expect(result.gathered[0]?.benchmark).toBeDefined();
		recordExampleCases(metaFor('gathers-a-declared-benchmark-file-into-a-record-ready-entry'), [
			{
				name: 'declared benchmark JSON file is written and admitted',
				input: { line: benchmarkLine, recordPath },
				output: summarize(result)
			}
		]);
	});
});

test('Reports a declared capture file that was never written', async () => {
	await withTempDir('gather-missing-', (directory) => {
		writeIndex(directory, [emptyLine]);
		const result = gatherCaptures(directory, recordPath);
		expect(result.gathered).toEqual([]);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]).toContain('evidence-grid-empty.png');
		recordExampleCases(metaFor('reports-a-declared-capture-file-that-was-never-written'), [
			{
				name: 'declared capture has no file on disk',
				input: { line: emptyLine, recordPath },
				output: summarize(result)
			}
		]);
	});
});

test('Refuses a capture file over the maxCaptureBytes limit', async () => {
	await withTempDir('gather-limit-', (directory) => {
		writeFileSync(join(directory, benchmarkFile), benchmarkBody);
		writeIndex(directory, [benchmarkLine]);
		const limits = { maxCaptureBytes: 4 };
		const result = gatherCaptures(directory, recordPath, limits);
		expect(result.gathered).toEqual([]);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]).toContain('maxCaptureBytes');
		recordExampleCases(metaFor('refuses-a-capture-file-over-the-maxcapturebytes-limit'), [
			{
				name: 'capture is larger than maxCaptureBytes 4',
				input: { line: benchmarkLine, limits },
				output: summarize(result)
			}
		]);
	});
});

test('Refuses an index that is a symlink', async () => {
	await withTempDir('gather-symlink-', (directory) => {
		writeFileSync(join(directory, 'real-index.ndjson'), `${JSON.stringify(benchmarkLine)}\n`);
		symlinkSync(join(directory, 'real-index.ndjson'), join(directory, 'captures.ndjson'));
		const result = gatherCaptures(directory, recordPath);
		expect(result.gathered).toEqual([]);
		expect(result.failures).toHaveLength(1);
		recordExampleCases(metaFor('refuses-an-index-that-is-a-symlink'), [
			{
				name: 'captures.ndjson is a symlink to another file',
				input: { recordPath },
				output: summarize(result)
			}
		]);
	});
});

test('Returns no captures when the evidence index is missing', async () => {
	await withTempDir('gather-no-index-', (directory) => {
		const result = gatherCaptures(directory, recordPath);
		expect(result.gathered).toEqual([]);
		expect(result.failures).toEqual([]);
		recordExampleCases(metaFor('returns-no-captures-when-the-evidence-index-is-missing'), [
			{
				name: 'directory has no captures.ndjson',
				input: { recordPath },
				output: summarize(result)
			}
		]);
	});
});
