import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { withTempDir } from '../../support/temporary';
import { contractUnit, writeContract } from '../../support/contractsProject';
import {
	assertHistoryOwnKeys,
	assertHistoryMetadataArrays,
	assertLegacyAndMergedHistory
} from '../../support/contractHistoryMatrix';
import {
	commitHistory,
	assertHistoryRefBoundaries,
	assertOrderedHistoryExamples,
	historyFixture,
	historyGit,
	reformatHistory,
	runHistory
} from '../../support/contractHistory';

test('ContractsCommand diff snapshots return complete semantic JSON and accurate ignored counts', () =>
	withTempDir('contract-history-', async (root) => {
		const { unit, initial } = await historyFixture(root);
		await reformatHistory(root);
		expect(JSON.parse(await runHistory(root, 'diff', '--json'))).toEqual({
			base: initial,
			head: 'working-tree',
			summary: {
				contracts: 0,
				added: 0,
				removed: 0,
				moved: 0,
				changed: 0,
				fields: 0,
				formattingOnlyFiles: 1,
				reorderedOnlyFiles: 0
			},
			total: 0,
			truncated: false,
			changes: []
		});
		await writeContract(root, 'price.json', {
			...unit,
			contract: { ...unit.contract, outputs: [...unit.contract.outputs].reverse() }
		});
		expect(JSON.parse(await runHistory(root, 'diff', '--json')).summary).toMatchObject({
			contracts: 0,
			formattingOnlyFiles: 0,
			reorderedOnlyFiles: 1
		});
		const changed = JSON.parse(JSON.stringify(unit)) as typeof unit;
		changed.contract.outputs.reverse();
		changed.contract.outputs.find((row) => row.name === 'total')!.type = 'Money';
		changed.futureField.enabled = true;
		await writeContract(root, 'price.json', changed);
		const diff = JSON.parse(await runHistory(root, 'diff', '--json'));
		expect(diff.changes).toEqual([
			{
				id: unit.id,
				kind: 'changed',
				contractPath: 'specification/units/price.json',
				sourcePaths: unit.owns.source,
				fields: [
					{ path: 'outputs[total].type', kind: 'changed', before: 'number', after: 'Money' },
					{ path: 'futureField.enabled', kind: 'changed', before: false, after: true }
				]
			}
		]);
		expect(await runHistory(root, 'diff')).toContain('outputs[total].type');
		await assertOrderedHistoryExamples(root, unit);
		await assertHistoryMetadataArrays(root);
	}));

test('ContractsCommand diff revisions distinguish commit range since staged and root commit', () =>
	withTempDir('contract-history-', async (root) => {
		const { unit, initial } = await historyFixture(root);
		unit.contract.outputs[0].type = 'Money';
		await writeContract(root, 'price.json', unit);
		const changed = commitHistory(root, 'feat: quoted money');
		await assertHistoryRefBoundaries(root);
		unit.contract.outputs[0].description = 'Unstaged text.';
		await writeContract(root, 'price.json', unit);
		for (const args of [[changed], [`${initial}..${changed}`], ['--staged']]) {
			const result = JSON.parse(await runHistory(root, 'diff', ...args, '--json'));
			expect(result.changes).toHaveLength(args[0] === '--staged' ? 0 : 1);
			if (result.changes.length) expect(result.changes[0].fields[0].after).toBe('Money');
		}
		expect(
			JSON.parse(await runHistory(root, 'diff', '--since', initial, '--json')).summary.fields
		).toBe(2);
		historyGit(root, 'add', '.');
		expect(JSON.parse(await runHistory(root, 'diff', '--staged', '--json')).summary.fields).toBe(1);
		expect(JSON.parse(await runHistory(root, 'diff', initial, '--json')).summary.added).toBe(1);
	}));

test('ContractsCommand diff preserves moves duplicate relations filters and summary totals', () =>
	withTempDir('contract-history-', async (root) => {
		const { unit } = await historyFixture(root);
		await mkdir(join(root, 'specification/units/moved'));
		await rename(
			join(root, 'specification/units/price.json'),
			join(root, 'specification/units/moved/price.json')
		);
		const changed = {
			...unit,
			id: 'service.quote',
			dependencies: [
				{ unit: 'model.invoice', via: 'import' },
				{ unit: 'model.invoice', via: 'contract' },
				{ unit: 'model.invoice', via: 'import' }
			]
		};
		await writeContract(root, 'moved/price.json', changed);
		await writeContract(root, 'new.json', contractUnit('model.new', 'src/models/New.ts'));
		const diff = JSON.parse(await runHistory(root, 'diff', '--limit', '1', '--json'));
		expect(diff.summary).toMatchObject({ contracts: 2, added: 1, moved: 1 });
		expect(diff.total).toBe(2);
		expect(diff.truncated).toBe(true);
		const selected = JSON.parse(
			await runHistory(
				root,
				'diff',
				'--unit',
				unit.id,
				'--folder',
				'src/services/billing',
				'--area',
				'billing',
				'--kind',
				'service',
				'--field',
				'dependencies',
				'--json'
			)
		);
		expect(selected.changes[0]).toMatchObject({
			id: 'service.quote',
			previousId: unit.id,
			kind: 'moved',
			previousContractPath: 'specification/units/price.json'
		});
		expect(selected.changes[0].fields).toHaveLength(3);
		expect(await runHistory(root, 'diff', '--summary')).toContain('moved');
	}));

test('ContractsCommand log and last follow unit identity and skip nonmaterial commits', () =>
	withTempDir('contract-history-', async (root) => {
		const { unit, initial } = await historyFixture(root);
		unit.contract.outputs[0].type = 'Money';
		await writeContract(root, 'price.json', unit);
		const changed = commitHistory(root, 'feat: use money');
		await reformatHistory(root);
		commitHistory(root, 'chore: format contract');
		unit.id = 'service.quote';
		await writeContract(root, 'price.json', unit);
		const moved = commitHistory(root, 'feat: rename quote');
		const log = JSON.parse(await runHistory(root, 'log', unit.id, '--json'));
		expect(log.entries.map((entry: { commit: string }) => entry.commit)).toEqual([
			moved,
			changed,
			initial
		]);
		expect(log.entries[1]).toMatchObject({
			author: { name: 'Contract Fixture', email: 'contract@example.invalid' },
			subject: 'feat: use money'
		});
		expect(log.entries[1].date).toMatch(/^\d{4}-\d\d-\d\dT/);
		const last = JSON.parse(await runHistory(root, 'last', unit.id, '--field', 'type', '--json'));
		expect(last.entries).toHaveLength(1);
		expect(last.entries[0].commit).toBe(changed);
		expect(last.entries[0].changes[0].fields).toEqual([
			{ path: 'outputs[total].type', kind: 'changed', before: 'number', after: 'Money' }
		]);
		expect(
			JSON.parse(await runHistory(root, 'log', '--folder', 'src/models', '--json')).entries
		).toEqual([]);
		expect(log.entries[0].changes[0].kind).toBe('moved');
		await assertLegacyAndMergedHistory(root);
	}));

test('ContractsCommand history validates revisions snapshots and raw documents without source reads', () =>
	withTempDir('contract-history-', async (root) => {
		const { unit } = await historyFixture(root);
		await expect(runHistory(root, 'diff', '--since', '--bad')).rejects.toThrow();
		await expect(runHistory(root, 'diff', 'missing-ref')).rejects.toThrow(/revision/i);
		await expect(runHistory(root, 'diff', '--staged', '--since', 'HEAD')).rejects.toThrow(
			/combine|exclusive/i
		);
		await expect(runHistory(root, 'diff', '--field', 'bogus')).rejects.toThrow(/field/i);
		await expect(runHistory(root, 'diff', '--folder', '../outside')).rejects.toThrow(
			/within|outside/i
		);
		await rm(join(root, 'specification/units/price.json'));
		expect(JSON.parse(await runHistory(root, 'diff', '--json')).summary.removed).toBe(1);
		await writeFile(join(root, 'specification/units/broken.json'), '{');
		await expect(runHistory(root, 'diff')).rejects.toThrow(/broken.json/i);
		await rm(join(root, 'specification/units/broken.json'));
		await writeContract(root, 'untracked.json', unit);
		expect(JSON.parse(await runHistory(root, 'diff', '--json')).changes[0].kind).toBe('moved');
		await assertHistoryOwnKeys(root);
	}));
