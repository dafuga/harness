import { join } from 'node:path';
import { test } from 'vitest';
import { HistorySyncService } from '../../src/cli/program/history-sync-service/HistorySyncService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

async function emptyRemote(repository: { root: string; git: (...args: string[]) => string }): Promise<string> {
	const remote = join(repository.root, 'remote.git');
	repository.git('init', '--bare', remote);
	repository.git('remote', 'add', 'origin', remote);
	return remote;
}

test('Fetches from a remote with no history', async () => {
	await withTempRepo(async (repository) => {
		await emptyRemote(repository);
		const result = await new HistorySyncService(repository.root).fetch('origin');
		expect(result).toEqual({ remote: 'origin', evidence: 'absent', notes: 'absent', pushed: false });
		recordExampleCases(
			{ unitId: 'service.history-sync', symbol: 'fetch', state: 'fetches-from-a-remote-with-no-history', evidence: 'examples-cases', file: 'fetches-from-a-remote-with-no-history.json' },
			[{ name: 'empty origin has no evidence or notes to fetch', input: { remote: 'origin' }, output: result }]
		);
	});
});

test('Pushes nothing to an empty remote', async () => {
	await withTempRepo(async (repository) => {
		const remote = await emptyRemote(repository);
		const result = await new HistorySyncService(repository.root).push('origin');
		expect(result).toEqual({ remote: 'origin', evidence: 'absent', notes: 'absent', pushed: false });
		expect(repository.git('--git-dir', remote, 'for-each-ref', '--format=%(refname)')).toBe('');
		recordExampleCases(
			{ unitId: 'service.history-sync', symbol: 'push', state: 'pushes-nothing-to-an-empty-remote', evidence: 'examples-cases', file: 'pushes-nothing-to-an-empty-remote.json' },
			[{ name: 'empty local history sends no refs', input: { remote: 'origin' }, output: result }]
		);
	});
});

test('Syncs an empty remote without sending history', async () => {
	await withTempRepo(async (repository) => {
		await emptyRemote(repository);
		const result = await new HistorySyncService(repository.root).sync('origin');
		expect(result).toEqual({ remote: 'origin', evidence: 'absent', notes: 'absent', pushed: false });
		recordExampleCases(
			{ unitId: 'service.history-sync', symbol: 'sync', state: 'syncs-an-empty-remote-without-sending-history', evidence: 'examples-cases', file: 'syncs-an-empty-remote-without-sending-history.json' },
			[{ name: 'fetch then push leaves both empty', input: { remote: 'origin' }, output: result }]
		);
	});
});

test('Throws ExpectedCliError when remote has evidence we lack', async () => {
	await withTempRepo(async (repository) => {
		const remote = await emptyRemote(repository);
		repository.git('commit', '--allow-empty', '-m', 'remote evidence');
		repository.git('push', remote, 'HEAD:refs/heads/harness-evidence');
		let caught: unknown;
		try {
			await new HistorySyncService(repository.root).push('origin');
		} catch (error) {
			caught = error;
		}
		expect(caught).toMatchObject({
			name: 'ExpectedCliError',
			message: 'origin has evidence this clone lacks; run harness history sync origin.'
		});
		const error = caught as Error;
		recordExampleCases(
			{ unitId: 'service.history-sync', symbol: 'push', state: 'throws-expectedclierror-when-remote-has-evidence-we-lack', evidence: 'examples-cases', file: 'throws-expectedclierror-when-remote-has-evidence-we-lack.json' },
			[{ name: 'push refuses remote evidence absent locally', input: { remote: 'origin' }, error: { name: error.name, message: error.message } }]
		);
	});
});
