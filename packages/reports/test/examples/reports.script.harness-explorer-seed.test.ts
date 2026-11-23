import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { explorerBranch, explorerUnits, seedExplorer } from '../../scripts/harness-explorer-seed';

function makeRepo() {
	const calls: Array<{ method: string; path?: string; args?: string[] }> = [];
	const repo = {
		write: async (path: string) => {
			calls.push({ method: 'write', path });
		},
		harness: async (args: string[]) => {
			calls.push({ method: 'harness', args });
			return '';
		},
		json: async (path: string) => {
			calls.push({ method: 'json', path });
			return { name: explorerUnits.config };
		}
	};
	return { repo: repo as unknown as Parameters<typeof seedExplorer>[0], calls };
}

test('Seeds the explorer fixture and indexes its config', async () => {
	const { repo, calls } = makeRepo();
	const output = await seedExplorer(repo);
	const writes = calls.filter((call) => call.method === 'write').map((call) => call.path);
	const indexes = calls.filter((call) => call.method === 'harness');
	expect(output).toBeUndefined();
	expect(writes).toContain('scripts/explorer.mjs');
	expect(indexes).toHaveLength(2);
	expect(explorerBranch).toBe('explorer/tip');
	expect(explorerUnits).toMatchObject({
		page: 'page.titles',
		list: 'component.title-list',
		row: 'component.title-row',
		slugify: 'function.slugify',
		config: 'config.titles',
		service: 'service.title'
	});
	recordExampleCases(
		{
			unitId: 'reports.script.harness-explorer-seed',
			symbol: 'seedExplorer',
			state: 'seeds-the-explorer-fixture-and-indexes-its-config',
			evidence: 'examples-cases',
			file: 'seeds-the-explorer-fixture-and-indexes-its-config.json'
		},
		[
			{
				name: 'writes fixture sources and scenarios, then indexes twice',
				input: { configUnit: explorerUnits.config },
				output: {
					resolved: output === undefined,
					writeCount: writes.length,
					includesExplorerScript: writes.includes('scripts/explorer.mjs'),
					indexCalls: indexes.map((call) => call.args)
				}
			}
		]
	);
});

test('Throws VerifyRepo rejection when a repository write fails', async () => {
	const calls: string[] = [];
	const reason = new Error('fixture write failed');
	const repo = {
		write: async (path: string) => {
			calls.push(`write:${path}`);
			throw reason;
		},
		harness: async () => {
			calls.push('harness');
			return '';
		},
		json: async () => {
			calls.push('json');
			return {};
		}
	} as unknown as Parameters<typeof seedExplorer>[0];
	await expect(seedExplorer(repo)).rejects.toBe(reason);
	expect(calls).toEqual(['write:src/config/titlesConfig.ts']);
	recordExampleCases(
		{
			unitId: 'reports.script.harness-explorer-seed',
			symbol: 'seedExplorer',
			state: 'throws-verifyrepo-rejection-when-a-repository-write-fails',
			evidence: 'examples-cases',
			file: 'throws-verifyrepo-rejection-when-a-repository-write-fails.json'
		},
		[
			{
				name: 'the first repository write rejection is propagated',
				input: { failingCall: 'write:src/config/titlesConfig.ts' },
				error: { message: reason.message }
			}
		]
	);
});
