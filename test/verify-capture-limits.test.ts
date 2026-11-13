import { createHash } from 'node:crypto';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { withTempDir } from './support/temporary';
import { captureIndex, defaultVerifyConfig, verifyConfigSchema } from '../src/core/verifyTypes';
import { gatherCaptures } from '../src/services/check-run-service/gatherCaptures';
import { digestFile } from '../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/captureLimits';
import * as captureFiles from '../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/captureLimits';
import { syntheticPng } from './support/syntheticPng';
import type { ResourceContext } from '../src/core/execution-runtimes/resourceTypes';
import type { IsolatedResult } from '../src/utils/run-isolated/runIsolated';

const passed: IsolatedResult = {
	status: 'passed',
	exitCode: 0,
	timedOut: false,
	durationMs: 1,
	log: { path: '/made/up/page.log', bytes: 0, sha256: '' },
	survivors: []
};

/** Writes files and an index naming them, the way a check leaves its evidence. */
function leave(folder: string, files: Record<string, Buffer>, kind = 'output') {
	const lines = Object.keys(files).map((file) => {
		const png = file.endsWith('.png');
		const shape = png
			? { kind: 'screenshot', mediaType: 'image/png', viewport: 'desktop' }
			: { kind, mediaType: 'text/plain' };
		return JSON.stringify({ evidence: 'proof', state: 'ready', file, ...shape });
	});
	for (const [file, bytes] of Object.entries(files)) writeFileSync(join(folder, file), bytes);
	writeFileSync(join(folder, captureIndex), `${lines.join('\n')}\n`);
}

test('with no cap a capture of any size is recorded with its streamed hash and size', () =>
	withTempDir('harness-capture-limits-', async (folder) => {
		// Larger than one read chunk, so the hash really is built from several reads.
		const big = Buffer.alloc(3 * 1024 * 1024 + 17, 'harness');
		leave(folder, { 'big.txt': big, 'empty.txt': Buffer.alloc(0) });
		const { gathered, failures } = gatherCaptures(folder, 'evidence');
		expect(failures).toEqual([]);
		const [first, second] = gathered.map((item) => item.capture);
		expect(first.sha256).toBe(createHash('sha256').update(big).digest('hex'));
		expect(first.bytes).toBe(big.length);
		expect(second.bytes).toBe(0);
		expect(second.sha256).toBe(createHash('sha256').digest('hex'));
	}));

test('media captures keep their decoded facts and the same hash as before', () =>
	withTempDir('harness-capture-limits-', async (folder) => {
		const png = syntheticPng(40, 30);
		leave(folder, { 'shot.png': png });
		const { gathered, failures } = gatherCaptures(folder, 'evidence', {
			maxCaptureBytes: 1_000_000
		});
		expect(failures).toEqual([]);
		expect(gathered[0].facts).toEqual({ kind: 'image', width: 40, height: 30 });
		expect(gathered[0].capture.sha256).toBe(createHash('sha256').update(png).digest('hex'));
		expect(gathered[0].capture.bytes).toBe(png.length);
	}));

test('a capture over maxCaptureBytes is refused with clear text and never recorded', () =>
	withTempDir('harness-capture-limits-', async (folder) => {
		leave(folder, { 'small.txt': Buffer.alloc(10), 'large.txt': Buffer.alloc(11) });
		const { gathered, failures } = gatherCaptures(folder, 'evidence', { maxCaptureBytes: 10 });
		expect(gathered.map((item) => item.line.file)).toEqual(['small.txt']);
		expect(failures).toEqual([
			'left capture large.txt of 11 bytes, over maxCaptureBytes 10 in harness.verify.json; it was not recorded'
		]);
		expect(() => digestFile(join(folder, 'large.txt'), 10)).toThrow(/maxCaptureBytes/);
		const nested = join(folder, 'nested');
		mkdirSync(nested);
		const outside = join(folder, 'outside.txt');
		writeFileSync(outside, 'synthetic private bytes');
		symlinkSync(outside, join(nested, 'linked.txt'));
		const index = join(nested, captureIndex);
		writeFileSync(
			index,
			JSON.stringify({
				evidence: 'proof',
				state: 'ready',
				file: 'linked.txt',
				kind: 'output',
				mediaType: 'text/plain'
			}) + '\n'
		);
		const linkedDirectory = join(folder, 'linked-directory');
		symlinkSync(nested, linkedDirectory);
		expect(gatherCaptures(linkedDirectory, 'evidence').failures.join(' ')).toContain('directory');
		const trusted = join(folder, 'trusted');
		const outsideLeaf = join(folder, 'outside-leaf', 'leaf');
		mkdirSync(trusted);
		mkdirSync(outsideLeaf, { recursive: true });
		leave(outsideLeaf, { 'proof.txt': Buffer.from('synthetic proof') });
		symlinkSync(join(folder, 'outside-leaf'), join(trusted, 'evidence'));
		const redirected = gatherCaptures(
			join(trusted, 'evidence', 'leaf'),
			'evidence/leaf',
			{},
			{ root: trusted }
		);
		expect(redirected.gathered).toEqual([]);
		expect(redirected.failures.join(' ')).toContain('ancestry');
		const linked = gatherCaptures(nested, 'evidence');
		expect(linked.gathered).toEqual([]);
		expect(linked.failures.join(' ')).toContain('regular file');
		writeFileSync(index, ' '.repeat(2_000_001));
		expect(gatherCaptures(nested, 'evidence').failures.join(' ')).toContain('capture index');
	}));

test('the optional caps are validated and absent by default', () => {
	expect(defaultVerifyConfig.maxCaptureBytes).toBeUndefined();
	const parse = (extra: object) =>
		verifyConfigSchema.safeParse({ ...defaultVerifyConfig, ...extra });
	expect(parse({}).success).toBe(true);
	const capped = parse({ maxCaptureBytes: 5_000_000, maxRecordBytes: 50_000_000 });
	expect(capped.success && [capped.data.maxCaptureBytes, capped.data.maxRecordBytes]).toEqual([
		5_000_000, 50_000_000
	]);
	for (const bad of [0, -1, 1.5, '10'])
		expect(parse({ maxRecordBytes: bad }).success, `maxRecordBytes ${String(bad)}`).toBe(false);
});

test('a check run keeps captures until maxRecordBytes and reports the rest as failures', () =>
	withTempDir('harness-capture-limits-', async (directory) => {
		vi.doMock('../src/utils/run-isolated/runIsolated', () => ({ runIsolated: async () => passed }));
		vi.doMock('../src/utils/execution-runtimes/resourceWork', () => ({
			resourceWork: async (
				_request: unknown,
				action: (context: Pick<ResourceContext, 'env' | 'track'>) => Promise<unknown>
			) => action({ env: {}, track: () => undefined })
		}));
		const { CheckRunService } = await import('../src/services/CheckRunService');
		vi.doUnmock('../src/utils/run-isolated/runIsolated');
		vi.doUnmock('../src/utils/execution-runtimes/resourceWork');
		const commit = 'c'.repeat(40);
		const context = { commit, tree: 'made-up', profile: 'made-up', env: {}, directory };
		const service = new CheckRunService({
			...context,
			snapshot: '/made/up',
			limits: { maxRecordBytes: 25 }
		});
		const reads = vi.spyOn(captureFiles, 'digestFile');
		const run = (name: string, size: number, kind = 'output') => {
			const evidence = join(directory, 'evidence', commit, 'checks', name);
			mkdirSync(evidence, { recursive: true });
			leave(evidence, { [`${name}.txt`]: Buffer.alloc(size) }, kind);
			const check = { id: name, name, target: name, cwd: '.', command: 'true' };
			return service.run({ ...check, kind: 'unit', runner: 'command', timeoutMs: 1000 });
		};
		const [first, second, third] = [
			await run('a', 20),
			await run('b', 10, 'benchmark'),
			await run('c', 5)
		];
		expect(first.gathered).toHaveLength(1);
		expect(first.passed).toBe(true);
		expect(second.passed).toBe(false);
		expect(second.entry.status).toBe('failed');
		expect(third.passed).toBe(true);
		expect(second.gathered).toHaveLength(0);
		expect(
			reads.mock.calls.some(([path]) => path.endsWith('/b.txt')),
			'rejected media must not be read'
		).toBe(false);
		reads.mockRestore();
		expect(second.failures).toEqual([
			`check b left capture evidence/${commit}/checks/b/b.txt of 10 bytes, which takes the record to 30 bytes, over maxRecordBytes 25 in harness.verify.json; it was not recorded`
		]);
		// A smaller capture later still fits in the room that is left.
		expect(third.gathered).toHaveLength(1);
	}));
