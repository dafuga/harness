import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { InvalidReportPublicationReceiptError } from '../../src/services/reports-media/report-command-service/report-retention-service/InvalidReportPublicationReceiptError';
import { ReportPagesRetentionAdapter } from '../../src/services/reports-media/report-command-service/report-retention-service/ReportPagesRetentionAdapter';
import type { Deployment } from '../../src/services/reports-media/report-command-service/report-retention-service/ReportPagesRetentionAdapter.types';

type Call = { args: string[] };
type RunnerResult = { code: number; output: string };

const RUN = 'run-20261114-0930';
const OTHER_RUN_ID = '1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a8b';
const MATCH_IDS = ['0f3c2a1e-6b7d-4c8e-9a0b-1d2e3f4a5b6c', '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d'];
const LISTING: Deployment[] = [
	{
		Id: MATCH_IDS[0],
		Environment: 'Preview',
		Branch: 'report-' + RUN,
		Deployment: 'https://0f3c2a1e.project-report-shares.pages.dev'
	},
	{
		Id: MATCH_IDS[1],
		Environment: 'Preview',
		Branch: 'report-' + RUN,
		Deployment: 'https://7a8b9c0d.project-report-shares.pages.dev'
	},
	{
		Id: OTHER_RUN_ID,
		Environment: 'Preview',
		Branch: 'report-run-20261115-1842',
		Deployment: 'https://1b2c3d4e.project-report-shares.pages.dev'
	}
];

// Fake Wrangler runner: answers the list call with `list`, and every delete call with success.
function fakeRunner(list: RunnerResult) {
	const calls: Call[] = [];
	const command = async (_file: string, args: string[]): Promise<RunnerResult> => {
		calls.push({ args });
		if (args.includes('list')) return list;
		return { code: 0, output: '' };
	};
	return { calls, command: command as never };
}

// Ids passed to delete calls (every call after the first list call), in call order.
function deletedIds(calls: Call[]): string[] {
	return calls.slice(1).flatMap((call) => call.args.filter((arg) => MATCH_IDS.includes(arg)));
}

async function failureOf(work: Promise<unknown>): Promise<unknown> {
	try {
		await work;
	} catch (error) {
		return error;
	}
	return undefined;
}

function summarise(error: unknown) {
	const { name, message } = error as Error;
	return { name, message };
}

// The adapter needs a Cloudflare account id before any Wrangler call; use a made-up one for the call only.
const ACCOUNT_KEY = 'PROJECT_REPORTS_R2_ACCOUNT_ID';
const EXAMPLE_ACCOUNT_ID = 'example-account-id';
async function withExampleAccount<T>(work: () => Promise<T>): Promise<T> {
	const previous = process.env[ACCOUNT_KEY];
	process.env[ACCOUNT_KEY] = EXAMPLE_ACCOUNT_ID;
	try {
		return await work();
	} finally {
		if (previous === undefined) delete process.env[ACCOUNT_KEY];
		else process.env[ACCOUNT_KEY] = previous;
	}
}

test('Purge deletes every matching Preview deployment', async () => {
	const runner = fakeRunner({ code: 0, output: JSON.stringify(LISTING) });
	const adapter = new ReportPagesRetentionAdapter(runner.command);
	const count = await withExampleAccount(() => adapter.purge({ run: RUN }));
	const deleted = deletedIds(runner.calls);
	expect(count).toBe(2);
	expect(deleted).toEqual(MATCH_IDS);
	expect(runner.calls).toHaveLength(3);
	recordExampleCases(
		{
			unitId: 'reports.adapter.report-pages-retention',
			symbol: 'ReportPagesRetentionAdapter.purge',
			state: 'purge-deletes-every-matching-preview-deployment',
			evidence: 'examples-cases',
			file: 'purge-deletes-every-matching-preview-deployment.json'
		},
		[
			{
				name: 'run with two Preview deployments on its branch deletes both',
				input: { receipt: { run: RUN }, dryRun: false },
				output: { count, deletedIds: deleted }
			}
		]
	);
});

test('Dry run counts matching deployments without deleting', async () => {
	const runner = fakeRunner({ code: 0, output: JSON.stringify(LISTING) });
	const adapter = new ReportPagesRetentionAdapter(runner.command);
	const count = await withExampleAccount(() => adapter.purge({ run: RUN }, true));
	expect(count).toBe(2);
	expect(deletedIds(runner.calls)).toEqual([]);
	expect(runner.calls).toHaveLength(1);
	recordExampleCases(
		{
			unitId: 'reports.adapter.report-pages-retention',
			symbol: 'ReportPagesRetentionAdapter.purge',
			state: 'dry-run-counts-matching-deployments-without-deleting',
			evidence: 'examples-cases',
			file: 'dry-run-counts-matching-deployments-without-deleting.json'
		},
		[
			{
				name: 'dry run lists the run branch and reports two matches with no delete call',
				input: { receipt: { run: RUN }, dryRun: true },
				output: { count, wranglerCalls: runner.calls.length }
			}
		]
	);
});

test('Purge rejects a receipt URL outside the Pages pattern', async () => {
	const runner = fakeRunner({ code: 0, output: '[]' });
	const adapter = new ReportPagesRetentionAdapter(runner.command);
	const receipt = { run: RUN, url: 'http://9c1f0a7e.project-report-shares.pages.dev' };
	const error = await failureOf(adapter.purge(receipt));
	expect(error).toBeInstanceOf(InvalidReportPublicationReceiptError);
	expect(summarise(error).message).toBe('Invalid report publication receipt');
	expect(runner.calls).toHaveLength(0);
	recordExampleCases(
		{
			unitId: 'reports.adapter.report-pages-retention',
			symbol: 'ReportPagesRetentionAdapter.purge',
			state: 'purge-rejects-a-receipt-url-outside-the-pages-pattern',
			evidence: 'examples-cases',
			file: 'purge-rejects-a-receipt-url-outside-the-pages-pattern.json'
		},
		[
			{
				name: 'http URL is rejected before any Wrangler call',
				input: { receipt },
				error: summarise(error)
			}
		]
	);
});

test('Purge fails when the Wrangler list run exits non-zero', async () => {
	const runner = fakeRunner({ code: 1, output: 'Wrangler failed' });
	const adapter = new ReportPagesRetentionAdapter(runner.command);
	const error = await withExampleAccount(() => failureOf(adapter.purge({ run: RUN })));
	expect(summarise(error).message).toBe(
		'Cloudflare Pages cleanup failed; local publication receipt retained for retry'
	);
	expect(deletedIds(runner.calls)).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.adapter.report-pages-retention',
			symbol: 'ReportPagesRetentionAdapter.purge',
			state: 'purge-fails-when-the-wrangler-list-run-exits-non-zero',
			evidence: 'examples-cases',
			file: 'purge-fails-when-the-wrangler-list-run-exits-non-zero.json'
		},
		[
			{
				name: 'list exit code 1 fails cleanup and deletes nothing',
				input: { receipt: { run: RUN }, listExitCode: 1 },
				error: summarise(error)
			}
		]
	);
});
