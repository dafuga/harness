import { test, vi } from 'vitest';
import type { Command } from 'commander';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { registerUnitsRename, registerUnitsUid } from '../../src/cli/program/unitsUid';
import { backfillUids } from '../../src/workflows/development-tooling/backfill-uids/backfillUids';
import { renameUnit } from '../../src/workflows/development-tooling/rename-unit/renameUnit';

vi.mock('../../src/workflows/development-tooling/backfill-uids/backfillUids', () => ({
	backfillUids: vi.fn()
}));
vi.mock('../../src/workflows/development-tooling/rename-unit/renameUnit', () => ({
	renameUnit: vi.fn()
}));

type Action = (...args: unknown[]) => unknown;

interface FakeSub {
	option(flag: string): FakeSub;
	description(text: string): FakeSub;
	action(handler: Action): FakeSub;
}

interface Registered {
	name: string;
	options: string[];
	description?: string;
	action?: Action;
}

function fakeUnits(): { units: Command; registered: Registered[] } {
	const registered: Registered[] = [];
	const units = {
		command(name: string): FakeSub {
			const entry: Registered = { name, options: [] };
			registered.push(entry);
			const sub: FakeSub = {
				option(flag: string) {
					entry.options.push(flag);
					return sub;
				},
				description(text: string) {
					entry.description = text;
					return sub;
				},
				action(handler: Action) {
					entry.action = handler;
					return sub;
				}
			};
			return sub;
		}
	};
	return { units: units as unknown as Command, registered };
}

function summarise(entry: Registered): Record<string, unknown> {
	return {
		name: entry.name,
		options: entry.options,
		description: entry.description,
		hasAction: entry.action !== undefined
	};
}

test('Registers the uid-backfill subcommand with its flags', () => {
	const { units, registered } = fakeUnits();
	const returned = registerUnitsUid(units);
	expect(returned).toBeUndefined();
	const summary = registered.map(summarise);
	expect(summary).toEqual([
		{
			name: 'uid-backfill',
			options: ['--write', '--json'],
			description: 'Give every unit a stable uid, keeping its id, contract and history.',
			hasAction: true
		}
	]);

	recordExampleCases(
		{
			unitId: 'entry.program-units-uid',
			symbol: 'registerUnitsUid',
			state: 'registers-the-uid-backfill-subcommand-with-its-flags',
			evidence: 'examples-cases',
			file: 'registers-the-uid-backfill-subcommand-with-its-flags.json'
		},
		[{ name: 'registers uid-backfill on a units command', input: 'units command', output: summary }]
	);
});

test('Registers the rename subcommand with its arguments', () => {
	const { units, registered } = fakeUnits();
	const returned = registerUnitsRename(units);
	expect(returned).toBeUndefined();
	const summary = registered.map(summarise);
	expect(summary).toEqual([
		{
			name: 'rename <id> <newId>',
			options: [],
			description: 'Give a unit another id; its uid, contract and history stay with it.',
			hasAction: true
		}
	]);

	recordExampleCases(
		{
			unitId: 'entry.program-units-uid',
			symbol: 'registerUnitsRename',
			state: 'registers-the-rename-subcommand-with-its-arguments',
			evidence: 'examples-cases',
			file: 'registers-the-rename-subcommand-with-its-arguments.json'
		},
		[{ name: 'registers rename on a units command', input: 'units command', output: summary }]
	);
});

function actionOf(registered: Registered[]): Action {
	const action = registered[0]?.action;
	if (!action) throw new Error('no action registered');
	return action;
}

test('Throws backfillUids when the uid backfill rejects', async () => {
	const { units, registered } = fakeUnits();
	registerUnitsUid(units);
	const failure = new Error('registry is locked');
	vi.mocked(backfillUids).mockRejectedValueOnce(failure);
	await expect(actionOf(registered)({ write: true })).rejects.toBe(failure);
	expect(vi.mocked(backfillUids)).toHaveBeenLastCalledWith({ write: true });

	recordExampleCases(
		{
			unitId: 'entry.program-units-uid',
			symbol: 'registerUnitsUid',
			state: 'throws-backfilluids-when-the-uid-backfill-rejects',
			evidence: 'examples-cases',
			file: 'throws-backfilluids-when-the-uid-backfill-rejects.json'
		},
		[{ name: 'uid-backfill action rejects', input: { write: true }, error: failure.message }]
	);
});

test('Throws renameUnit when the rename rejects', async () => {
	const { units, registered } = fakeUnits();
	registerUnitsRename(units);
	const failure = new Error('target id already exists');
	vi.mocked(renameUnit).mockRejectedValueOnce(failure);
	await expect(actionOf(registered)('unit.old', 'unit.new')).rejects.toBe(failure);
	expect(vi.mocked(renameUnit)).toHaveBeenLastCalledWith('unit.old', 'unit.new');

	recordExampleCases(
		{
			unitId: 'entry.program-units-uid',
			symbol: 'registerUnitsRename',
			state: 'throws-renameunit-when-the-rename-rejects',
			evidence: 'examples-cases',
			file: 'throws-renameunit-when-the-rename-rejects.json'
		},
		[
			{
				name: 'rename action rejects',
				input: { id: 'unit.old', newId: 'unit.new' },
				error: failure.message
			}
		]
	);
});
