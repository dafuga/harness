import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { withTempDir } from './support/temporary';
import { captureIndex } from '../src/core/verifyTypes';
import { gatherCaptures } from '../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/gatherCaptures';
import * as captureFiles from '../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/captureLimits';
import type { ResourceContext } from '../src/core/execution-runtimes/resourceTypes';
import type { IsolatedResult } from '../src/utils/run-isolated/runIsolated';

/** The fixed cap on one check's `captures.ndjson`; this value is the contract under test. */
const indexCap = 2_000_000;
const line = `${JSON.stringify({
	evidence: 'proof',
	state: 'ready',
	file: 'proof.txt',
	kind: 'output',
	mediaType: 'text/plain'
})}\n`;
const refusal = (bytes: number) =>
	`left capture index ${captureIndex} of ${bytes} bytes, over the fixed capture index cap of ` +
	`${indexCap} bytes; none of the captures it names were recorded`;

/** One valid capture line padded with blank lines, so the index has exactly `bytes` bytes. */
function leave(folder: string, bytes: number) {
	writeFileSync(join(folder, 'proof.txt'), 'synthetic proof');
	writeFileSync(join(folder, captureIndex), line + '\n'.repeat(bytes - line.length));
}

test('an index at the cap is read; one byte more is refused by name and never opened', () =>
	withTempDir('harness-capture-index-', async (folder) => {
		leave(folder, indexCap);
		const atCap = gatherCaptures(folder, 'evidence');
		expect(atCap.failures).toEqual([]);
		expect(atCap.gathered.map((item) => item.capture.path)).toEqual(['evidence/proof.txt']);

		leave(folder, indexCap + 1);
		const reads = vi.spyOn(captureFiles, 'digestFile');
		const over = gatherCaptures(folder, 'evidence');
		const opened = reads.mock.calls.map(([path]) => path);
		reads.mockRestore();
		expect(over.gathered).toEqual([]);
		expect(over.failures).toEqual([refusal(indexCap + 1)]);
		expect(opened, 'neither the oversized index nor its captures are opened').toEqual([]);
	}));

test('a check whose index is over the cap fails with the cap and the file in its failure', () =>
	withTempDir('harness-capture-index-', async (directory) => {
		const passed: IsolatedResult = {
			status: 'passed',
			exitCode: 0,
			timedOut: false,
			durationMs: 1,
			log: { path: '/made/up/page.log', bytes: 0, sha256: '' },
			survivors: []
		};
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
		const service = new CheckRunService({
			commit,
			tree: 'made-up',
			profile: 'made-up',
			env: {},
			directory,
			snapshot: '/made/up'
		});
		const evidence = join(directory, 'evidence', commit, 'checks', 'a');
		mkdirSync(evidence, { recursive: true });
		leave(evidence, indexCap + 1);
		const check = { id: 'a', name: 'a', target: 'a', cwd: '.', command: 'true' };
		const outcome = await service.run({
			...check,
			kind: 'unit',
			runner: 'command',
			timeoutMs: 1000
		});
		expect(outcome.passed).toBe(false);
		expect(outcome.entry.status).toBe('failed');
		expect(outcome.gathered).toEqual([]);
		expect(outcome.failures).toEqual([`check a ${refusal(indexCap + 1)}`]);
	}));
