import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { syncHistory, renderSync } from '../../src/cli/program/syncHistory';
import type { SyncAction } from '../../src/cli/program/syncHistory.types';
import type { Synced } from '../../src/cli/program/history-sync-service/HistorySyncService.types';

const missingRemoteState = 'rejects-when-the-remote-is-unknown';
const rendersResultState = 'renders-fetch-and-transfer-results';

test('Rejects when the remote is unknown', async () => {
	await withTempRepo(async ({ root }) => {
		let error: unknown;
		try {
			await syncHistory('fetch', 'upstream', root);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('"upstream" is not a remote of this repository.');
		recordExampleCases(
			{
				unitId: 'workflow.sync-history',
				symbol: 'syncHistory',
				state: missingRemoteState,
				evidence: 'examples-cases',
				file: `${missingRemoteState}.json`
			},
			[
				{
					name: 'unknown remote rejects before history exchange',
					input: { action: 'fetch', remote: 'upstream', root },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});

test('Renders fetch and transfer results', () => {
	const cases: Array<{ action: SyncAction; result: Synced }> = [
		{
			action: 'fetch',
			result: { evidence: 'created', notes: 'fast-forwarded', pushed: false, remote: 'origin' }
		},
		{
			action: 'push',
			result: { evidence: 'created', notes: 'fast-forwarded', pushed: true, remote: 'origin' }
		},
		{
			action: 'sync',
			result: { evidence: 'unchanged', notes: 'absent', pushed: false, remote: 'upstream' }
		}
	];
	const outputs = cases.map(({ action, result }) => renderSync(action, result));
	expect(outputs).toEqual([
		'Evidence created, notes fast-forwarded.',
		'Evidence created, notes fast-forwarded; sent to origin.',
		'Evidence unchanged, notes absent; nothing sent to upstream.'
	]);
	recordExampleCases(
		{
			unitId: 'workflow.sync-history',
			symbol: 'renderSync',
			state: rendersResultState,
			evidence: 'examples-cases',
			file: `${rendersResultState}.json`
		},
		cases.map(({ action, result }, index) => ({
			name: `${action} summarizes ${result.pushed ? 'sent' : 'unsent'} history`,
			input: { action, result },
			output: outputs[index]
		}))
	);
});
