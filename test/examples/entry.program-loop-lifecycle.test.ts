import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { registerLoopLifecycleCommands } from '../../src/cli/program/loopLifecycle';

type Action = (...args: unknown[]) => unknown;
interface Subcommand {
	name: string;
	options: string[];
	description?: string;
	action?: Action;
}
interface Chain {
	option(flags: string): Chain;
	description(text: string): Chain;
	action(fn: Action): Chain;
}
type Program = Parameters<typeof registerLoopLifecycleCommands>[0];
type Case = { name: string; input: unknown; error: unknown };

const unitId = 'entry.program-loop-lifecycle';
const symbol = 'registerLoopLifecycleCommands';
const closeMessage = 'Pass --abandoned: it is the only way to close a loop for now.';
const staleError = {
	name: 'ExpectedCliError',
	message: '--stale needs a number of days, 0 or more, as a whole number.'
};

function recordingProgram(): { program: Program; subcommands: Subcommand[] } {
	const subcommands: Subcommand[] = [];
	const program = {
		command(spec: string): Chain {
			const entry: Subcommand = { name: spec, options: [] };
			subcommands.push(entry);
			const chain: Chain = {
				option(flags: string): Chain {
					entry.options.push(flags);
					return chain;
				},
				description(text: string): Chain {
					entry.description = text;
					return chain;
				},
				action(fn: Action): Chain {
					entry.action = fn;
					return chain;
				}
			};
			return chain;
		}
	};
	return { program: program as unknown as Program, subcommands };
}

function subcommand(subcommands: Subcommand[], name: string): Subcommand {
	const found = subcommands.find((entry) => entry.name === name);
	if (!found) throw new Error(`missing subcommand ${name}`);
	return found;
}

function summarise(entry: Subcommand): Record<string, unknown> {
	return {
		name: entry.name,
		options: entry.options,
		description: entry.description,
		hasAction: entry.action !== undefined
	};
}

function invoke(entry: Subcommand, args: unknown[]): unknown {
	if (!entry.action) throw new Error(`no action for ${entry.name}`);
	return entry.action(...args);
}

async function rejectionOf(run: () => unknown): Promise<{ name: string; message: string }> {
	try {
		await run();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	throw new Error('expected the action to reject');
}

test('Registers the list and close subcommands with their flags', () => {
	const { program, subcommands } = recordingProgram();
	registerLoopLifecycleCommands(program);
	expect(subcommands.map((entry) => entry.name)).toEqual(['list', 'close <loop>']);

	const list = subcommand(subcommands, 'list');
	const close = subcommand(subcommands, 'close <loop>');
	expect(list.options).toEqual(['--stale <days>', '--json']);
	expect(close.options).toEqual(['--abandoned', '--reason <text>']);
	expect(list.description).toBe('List open loops with age and open-step count.');
	expect(close.description).toBe('Close a loop without completing its steps.');
	expect(list.action).toBeTypeOf('function');
	expect(close.action).toBeTypeOf('function');

	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'registers-the-list-and-close-subcommands-with-their-flags',
			evidence: 'examples-cases',
			file: 'registers-the-list-and-close-subcommands-with-their-flags.json'
		},
		[
			{ name: 'list subcommand', input: { command: 'list' }, output: summarise(list) },
			{ name: 'close subcommand', input: { command: 'close <loop>' }, output: summarise(close) }
		]
	);
});

test('Rejects close without --abandoned and invalid --stale values', async () => {
	const { program, subcommands } = recordingProgram();
	registerLoopLifecycleCommands(program);
	const list = subcommand(subcommands, 'list');
	const close = subcommand(subcommands, 'close <loop>');

	const closeInput = { loop: 'loop-7', options: { reason: 'superseded' } };
	const closeError = await rejectionOf(() => invoke(close, ['loop-7', closeInput.options]));
	expect(closeError).toEqual({ name: 'ExpectedCliError', message: closeMessage });

	const staleValues = ['abc', '-1', '1.5'];
	const staleCases: Case[] = await Promise.all(
		staleValues.map(async (stale) => ({
			name: `list --stale ${stale}`,
			input: { stale },
			error: await rejectionOf(() => invoke(list, [{ stale }]))
		}))
	);
	expect(staleCases.map((entry) => entry.error)).toEqual(staleValues.map(() => staleError));

	const closeCase: Case = {
		name: 'close loop-7 without --abandoned',
		input: closeInput,
		error: closeError
	};
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'rejects-close-without-abandoned-and-invalid-stale-values',
			evidence: 'examples-cases',
			file: 'rejects-close-without-abandoned-and-invalid-stale-values.json'
		},
		[closeCase, ...staleCases]
	);
});
