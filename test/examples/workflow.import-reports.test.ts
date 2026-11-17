import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { importReports, renderImport } from '../../src/cli/program/importReports';
import type { ImportOptions } from '../../src/cli/program/importReports.types';

const UNIT_ID = 'workflow.import-reports';

const FIRST_RESULT: Parameters<typeof renderImport>[0] = {
	imported: [
		{
			id: 'run-20261002-091453',
			status: 'passed',
			startedAt: '2026-10-02T09:14:53.000Z',
			revision: '3f9c2ab',
			linked: '3f9c2ab71d0e4b5c8a6f1e2d3c4b5a6978695a4b',
			media: 2,
			created: true
		}
	],
	skipped: [
		{ id: 'run-20260928-100044', reason: 'is not a report manifest' },
		{ id: 'run-20260930-081200', reason: 'belongs to another project' }
	]
};

const SECOND_RESULT: Parameters<typeof renderImport>[0] = {
	imported: [
		{
			id: 'run-20261003-112007',
			status: 'running',
			startedAt: '2026-10-03T11:20:07.000Z',
			revision: null,
			linked: null,
			media: 0,
			created: false
		},
		{
			id: 'run-20261004-150531',
			status: 'failed',
			startedAt: '2026-10-04T15:05:31.000Z',
			revision: '9d41e07',
			linked: null,
			media: 1,
			created: true
		}
	],
	skipped: []
};

const FIRST_TEXT = [
	'1 legacy reports of this repository:',
	'  run-20261002-091453: passed, 2026-10-02T09:14:53.000Z, linked to 3f9c2ab71d0e, 2 media, imported',
	'  run-20260928-100044: skipped, is not a report manifest',
	'  run-20260930-081200: skipped, belongs to another project'
].join('\n');

const SECOND_TEXT = [
	'2 legacy reports of this repository:',
	'  run-20261003-112007: running, 2026-10-03T11:20:07.000Z, unlinked, 0 media, already imported',
	'  run-20261004-150531: failed, 2026-10-04T15:05:31.000Z, unlinked, 1 media, imported'
].join('\n');

function meta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

async function captureError(run: () => Promise<unknown>): Promise<Error | undefined> {
	try {
		await run();
		return undefined;
	} catch (caught) {
		return caught as Error;
	}
}

function errorRecord(error: Error | undefined, root: string) {
	return {
		name: error?.name,
		message: (error?.message ?? '').split(root).join('<root>')
	};
}

test('Rejects when the legacy report store does not exist', async () => {
	await withTempRepo(async ({ root }) => {
		const from = join(root, 'missing-store');
		const options: ImportOptions = { root, from };
		const error = await captureError(() => importReports(options));

		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe(`${from} does not exist.`);
		recordExampleCases(meta('importReports', 'rejects-when-the-legacy-report-store-does-not-exist'), [
			{
				name: 'store path missing inside the repository rejects before any report is read',
				input: { root: '<root>', from: 'missing-store' },
				error: errorRecord(error, root)
			}
		]);
	});
});

test('Rejects when no legacy report store is given', async () => {
	await withTempRepo(async ({ root }) => {
		const options: ImportOptions = { root };
		const error = await captureError(() => importReports(options));

		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe('--from must name the legacy report store to read.');
		recordExampleCases(meta('importReports', 'rejects-when-no-legacy-report-store-is-given'), [
			{
				name: 'missing from option rejects with the requirement message',
				input: { root: '<root>' },
				error: errorRecord(error, root)
			}
		]);
	});
});

test('Rejects outside a Git repository', async () => {
	await withTempDir('import-reports-no-git-', async (root) => {
		const options: ImportOptions = { root, from: root };
		const error = await captureError(() => importReports(options));

		expect(error).toBeInstanceOf(Error);
		expect(error?.message).toBe('harness history needs a Git repository.');
		recordExampleCases(meta('importReports', 'rejects-outside-a-git-repository'), [
			{
				name: 'root that is not a Git repository rejects before the store is checked',
				input: { root: '<root>', from: '<root>' },
				error: errorRecord(error, root)
			}
		]);
	});
});

test('Renders imported and skipped runs of a repository', () => {
	const first = renderImport(FIRST_RESULT);
	const second = renderImport(SECOND_RESULT);

	expect(first).toBe(FIRST_TEXT);
	expect(second).toBe(SECOND_TEXT);
	recordExampleCases(meta('renderImport', 'renders-imported-and-skipped-runs-of-a-repository'), [
		{ name: 'linked report plus two skipped runs', input: FIRST_RESULT, output: first },
		{ name: 'unlinked running and failed reports with no skipped runs', input: SECOND_RESULT, output: second }
	]);
});
