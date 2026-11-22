import { test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { layerRatchet, reuseRatchet, mkdtempCallCount, temporaryCallRatchet } from '../../scripts/check-debt-ratchets';
import type { LayerEdge, ReuseBaseline, TemporaryCallBaseline } from '../../scripts/check-debt-ratchets.types';

const reportsEdge: LayerEdge = { from: 'src/domain/reports', to: 'src/ui/components', todo: 'Route the report summary through the view model.' };
const dbEdge: LayerEdge = { from: 'src/server/db', to: 'src/ui/format', todo: 'Move the date formatter into src/core.' };
const billingEdge: LayerEdge = {
	from: 'src/domain/billing',
	to: 'src/ui/components',
	todo: 'Split the invoice table out of the domain layer.'
};

const importsMkdtemp = `import { mkdtemp } from 'node:fs/promises';\nexport async function scratchDir() { return mkdtemp('/tmp/case-'); }`;
const namespaceMkdtemp = `import * as fs from 'node:fs';\nconst dir = fs.mkdtempSync('/tmp/case-');`;
const readOnly = `import { readFile } from 'node:fs/promises';\nexport const label = 'mkdtemp is only text here';`;

test('Lists layer edges that are new since the base', () => {
	const grown = layerRatchet([reportsEdge, dbEdge], [dbEdge, billingEdge]);
	const shrunk = layerRatchet([reportsEdge], []);
	expect(grown).toEqual({
		before: 2,
		after: 2,
		added: ['src/domain/billing -> src/ui/components'],
		removed: ['src/domain/reports -> src/ui/components']
	});
	expect(shrunk).toEqual({
		before: 1,
		after: 0,
		added: [],
		removed: ['src/domain/reports -> src/ui/components']
	});
	recordExampleCases(
		{
			unitId: 'script.check-debt-ratchets',
			symbol: 'layerRatchet',
			state: 'lists-layer-edges-that-are-new-since-the-base',
			evidence: 'examples-cases',
			file: 'lists-layer-edges-that-are-new-since-the-base.json'
		},
		[
			{
				name: 'one new edge and one removed edge',
				input: { before: [reportsEdge, dbEdge], after: [dbEdge, billingEdge] },
				output: grown
			},
			{
				name: 'allowlist emptied: removed only',
				input: { before: [reportsEdge], after: [] },
				output: shrunk
			}
		]
	);
});

test('Reports reuse findings that grew and counts that dropped', () => {
	const before: ReuseBaseline = { 'src/ui/format.ts': 3, 'src/server/reports.ts': 2 };
	const after: ReuseBaseline = { 'src/ui/format.ts': 4, 'src/server/reports.ts': 1 };
	const changed = reuseRatchet(before, after);
	const emptied = reuseRatchet({ 'src/server/reports.ts': 2 }, {});
	expect(changed).toEqual({
		before: 5,
		after: 5,
		added: ['src/ui/format.ts: 3 -> 4'],
		reduced: ['src/server/reports.ts: 2 -> 1']
	});
	expect(emptied).toEqual({
		before: 2,
		after: 0,
		added: [],
		reduced: ['src/server/reports.ts: 2 -> 0']
	});
	recordExampleCases(
		{
			unitId: 'script.check-debt-ratchets',
			symbol: 'reuseRatchet',
			state: 'reports-reuse-findings-that-grew-and-counts-that-dropped',
			evidence: 'examples-cases',
			file: 'reports-reuse-findings-that-grew-and-counts-that-dropped.json'
		},
		[
			{ name: 'one path grows, one path drops', input: { before, after }, output: changed },
			{
				name: 'all findings removed',
				input: { before: { 'src/server/reports.ts': 2 }, after: {} },
				output: emptied
			}
		]
	);
});

test('Counts only imported mkdtemp and mkdtempSync calls', () => {
	const named = mkdtempCallCount(importsMkdtemp);
	const namespace = mkdtempCallCount(namespaceMkdtemp);
	const none = mkdtempCallCount(readOnly);
	expect(named).toBe(1);
	expect(namespace).toBe(1);
	expect(none).toBe(0);
	recordExampleCases(
		{
			unitId: 'script.check-debt-ratchets',
			symbol: 'mkdtempCallCount',
			state: 'counts-only-imported-mkdtemp-and-mkdtempsync-calls',
			evidence: 'examples-cases',
			file: 'counts-only-imported-mkdtemp-and-mkdtempsync-calls.json'
		},
		[
			{ name: 'named import from node:fs/promises', input: importsMkdtemp, output: named },
			{ name: 'namespace import of node:fs', input: namespaceMkdtemp, output: namespace },
			{ name: 'no mkdtemp import, text only', input: readOnly, output: none }
		]
	);
});

test('Flags a grown test file and an over-limit shared helper', () => {
	const baseline: TemporaryCallBaseline = {
		'test/adapters/git.test.ts': 1,
		'test/claude-picker-start.test.ts': 1
	};
	const grown = temporaryCallRatchet(baseline, {
		'test/adapters/git.test.ts': 1,
		'test/claude-picker-start.test.ts': 2
	});
	const helper = temporaryCallRatchet(
		{ 'test/adapters/git.test.ts': 1, 'test/support/temporary.ts': 1 },
		{ 'test/adapters/git.test.ts': 1, 'test/support/temporary.ts': 2 }
	);
	expect(grown).toEqual({
		before: 2,
		after: 3,
		added: ['test/claude-picker-start.test.ts: 1 -> 2']
	});
	expect(helper).toEqual({
		before: 2,
		after: 3,
		added: ['test/support/temporary.ts: shared helper has 2 direct mkdtemp calls (maximum 1)']
	});
	recordExampleCases(
		{
			unitId: 'script.check-debt-ratchets',
			symbol: 'temporaryCallRatchet',
			state: 'flags-a-grown-test-file-and-an-over-limit-shared-helper',
			evidence: 'examples-cases',
			file: 'flags-a-grown-test-file-and-an-over-limit-shared-helper.json'
		},
		[
			{
				name: 'test file gains a direct mkdtemp call',
				input: { before: baseline },
				output: grown
			},
			{
				name: 'shared helper has two direct calls',
				input: { before: { 'test/support/temporary.ts': 1 } },
				output: helper
			}
		]
	);
});

test('Throws Debt baseline inspection failure when an inventory cannot be read', async () => {
	const result = await withTempRepo(async ({ root, git }) => {
		for (const [file, body] of [
			['eslint.layer-allowlist.json', '{"edges":[]}'],
			['eslint.reuse-baseline.json', '{}']
		]) writeFileSync(resolve(root, file), body);
		git('add', '.');
		git('commit', '-m', 'chore: add ratchet fixture');
		writeFileSync(resolve(root, 'eslint.layer-allowlist.json'), '{');
		return spawnSync(
			'env',
			['HARNESS_DEBT_RATCHET_BASE=HEAD', 'bun', resolve('scripts/check-debt-ratchets.ts')],
			{ cwd: root, encoding: 'utf8' }
		);
	});
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('SyntaxError');
	recordExampleCases(
		{
			unitId: 'script.check-debt-ratchets',
			symbol: 'layerRatchet',
			state: 'throws-debt-baseline-inspection-failure-when-an-inventory-ca',
			evidence: 'examples-cases',
			file: 'throws-debt-baseline-inspection-failure-when-an-inventory-ca.json'
		},
		[
			{
				name: 'current allowlist is invalid JSON',
				input: { file: 'eslint.layer-allowlist.json', contents: '{' },
				error: 'SyntaxError'
			}
		]
	);
});
