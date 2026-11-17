import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { renameUnit } from '../../src/workflows/development-tooling/rename-unit/renameUnit';
import type { RenameOptions, RenameReport } from '../../src/workflows/development-tooling/rename-unit/renameUnit.types';

const UNIT_ID = 'workflow.development-tooling-rename-unit-rename-unit';
const UNITS = join('specification', 'units');
const AT = '2026-11-16T00:00:00.000Z';

function pinned(root: string): RenameOptions {
	return { root, now: () => AT };
}

function unitSpec(id: string, status: 'active' | 'retired', extra: Record<string, unknown> = {}) {
	const letters = id.replace(/[^a-z]/g, '').padEnd(10, 'a').slice(0, 10);
	return {
		schemaVersion: 1,
		id,
		uid: `u_${letters}`,
		kind: 'function',
		title: id,
		responsibility: `Example unit ${id}.`,
		responsibilityOrigin: 'declared',
		status,
		owns: { source: [], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'src/example.ts',
			targets: [{ kind: 'module', entry: 'src/example.ts' }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		...extra
	};
}

function writeUnits(root: string, units: Array<{ id: string }>): void {
	mkdirSync(join(root, UNITS), { recursive: true });
	for (const unit of units) {
		writeFileSync(join(root, UNITS, `${unit.id}.json`), JSON.stringify(unit, null, '\t'));
	}
}

async function failureOf(run: () => Promise<unknown>): Promise<{ name: string; message: string }> {
	try {
		await run();
		return { name: 'none', message: '' };
	} catch (error) {
		return { name: (error as Error).name, message: (error as Error).message };
	}
}

test('Renames an active unit and rewrites the specs that depend on it', async () => {
	await withTempRepo(async ({ root }) => {
		writeUnits(root, [
			unitSpec('function.stable-json', 'active'),
			unitSpec('workflow.load-units', 'active', {
				dependencies: [{ unit: 'function.stable-json', via: 'import', origin: 'declared' }]
			}),
			unitSpec('function.other', 'active')
		]);
		const report: RenameReport = await renameUnit(
			'function.stable-json',
			'function.stable-stringify',
			pinned(root)
		);
		const consumer = JSON.parse(
			readFileSync(join(root, UNITS, 'workflow.load-units.json'), 'utf8')
		) as { dependencies: Array<{ unit: string }> };

		expect(report).toEqual({
			from: 'function.stable-json',
			to: 'function.stable-stringify',
			rewritten: ['specification/units/workflow.load-units.json']
		});
		expect(consumer.dependencies[0]?.unit).toBe('function.stable-stringify');
		expect(existsSync(join(root, UNITS, 'function.stable-stringify.json'))).toBe(true);
		recordExampleCases(
			{
				unitId: UNIT_ID,
				symbol: 'renameUnit',
				state: 'renames-an-active-unit-and-rewrites-the-specs-that-depend-on',
				evidence: 'examples-cases',
				file: 'renames-an-active-unit-and-rewrites-the-specs-that-depend-on.json'
			},
			[
				{
					name: 'rename function.stable-json to function.stable-stringify with one dependent spec',
					input: { from: 'function.stable-json', to: 'function.stable-stringify' },
					output: report
				}
			]
		);
	});
});

test('Rejects an unknown or retired source unit', async () => {
	await withTempRepo(async ({ root }) => {
		writeUnits(root, [
			unitSpec('function.old-name', 'retired', {
				retired: { reason: 'Renamed to function.fresh.', at: AT }
			})
		]);
		const unknown = await failureOf(() =>
			renameUnit('function.missing', 'function.fresh', pinned(root))
		);
		const retired = await failureOf(() =>
			renameUnit('function.old-name', 'function.fresh', pinned(root))
		);

		expect(unknown.message).toBe('Unknown active unit "function.missing".');
		expect(retired.message).toBe('Unknown active unit "function.old-name".');
		expect(existsSync(join(root, UNITS, 'function.fresh.json'))).toBe(false);
		recordExampleCases(
			{
				unitId: UNIT_ID,
				symbol: 'renameUnit',
				state: 'rejects-an-unknown-or-retired-source-unit',
				evidence: 'examples-cases',
				file: 'rejects-an-unknown-or-retired-source-unit.json'
			},
			[
				{
					name: 'source id that no stored unit has',
					input: { from: 'function.missing', to: 'function.fresh' },
					error: unknown
				},
				{
					name: 'source id of a retired unit',
					input: { from: 'function.old-name', to: 'function.fresh' },
					error: retired
				}
			]
		);
	});
});

test('Rejects a target id that is malformed or already used', async () => {
	await withTempRepo(async ({ root }) => {
		writeUnits(root, [
			unitSpec('function.stable-json', 'active'),
			unitSpec('function.old-name', 'retired', {
				retired: { reason: 'Renamed to function.fresh.', at: AT }
			})
		]);
		const malformed = await failureOf(() =>
			renameUnit('function.stable-json', 'Function Stable', pinned(root))
		);
		const used = await failureOf(() =>
			renameUnit('function.stable-json', 'function.old-name', pinned(root))
		);

		expect(malformed.message).toBe('"Function Stable" is not a valid unit id.');
		expect(used.message).toContain('A unit with id "function.old-name" exists already');
		expect(existsSync(join(root, UNITS, 'function.stable-json.json'))).toBe(true);
		recordExampleCases(
			{
				unitId: UNIT_ID,
				symbol: 'renameUnit',
				state: 'rejects-a-target-id-that-is-malformed-or-already-used',
				evidence: 'examples-cases',
				file: 'rejects-a-target-id-that-is-malformed-or-already-used.json'
			},
			[
				{
					name: 'target id with spaces and capitals is malformed',
					input: { from: 'function.stable-json', to: 'Function Stable' },
					error: malformed
				},
				{
					name: 'target id of a retired unit is already used',
					input: { from: 'function.stable-json', to: 'function.old-name' },
					error: used
				}
			]
		);
	});
});
