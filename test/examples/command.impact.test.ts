import { Command } from 'commander';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { registerImpactCommand } from '../../src/cli/program/ImpactCommand';

const DESCRIPTION = 'Report the units, tests and scenarios a change affects, across base and head.';
const MISSING_BASE = 'no-such-revision-for-impact';

async function parseImpact(args: string[]): Promise<Record<string, unknown>> {
	const program = new Command().name('harness');
	registerImpactCommand(program);
	let parsed: Record<string, unknown> = {};
	program.hook('preAction', (_root, action) => {
		parsed = action.opts();
		throw new Error('stopped before runImpact');
	});
	await program.parseAsync(['node', 'harness', 'impact', ...args]).catch(() => undefined);
	return parsed;
}

async function runImpactInRepo(root: string, args: string[]): Promise<unknown> {
	const program = new Command().name('harness');
	registerImpactCommand(program);
	const previous = process.cwd();
	process.chdir(root);
	try {
		await program.parseAsync(['node', 'harness', 'impact', ...args]);
		return undefined;
	} catch (failure) {
		return failure;
	} finally {
		process.chdir(previous);
	}
}

test('Registers the impact command with its flags', () => {
	const program = new Command().name('harness');
	const returned = registerImpactCommand(program);
	const impact = program.commands.find((command) => command.name() === 'impact');
	const options = impact?.options.map((option) => ({
		flags: option.flags,
		defaultValue: option.defaultValue ?? null
	}));
	const commands = program.commands.map((command) => command.name());

	expect(returned).toBeUndefined();
	expect(commands).toEqual(['impact']);
	expect(impact?.description()).toBe(DESCRIPTION);
	expect(options).toEqual([
		{ flags: '--base <revision>', defaultValue: 'HEAD' },
		{ flags: '--head <revision>', defaultValue: null },
		{ flags: '--runtime <kind>', defaultValue: null },
		{ flags: '--json', defaultValue: null }
	]);
	recordExampleCases(
		{
			unitId: 'command.impact',
			symbol: 'registerImpactCommand',
			state: 'registers-the-impact-command-with-its-flags',
			evidence: 'examples-cases',
			file: 'registers-the-impact-command-with-its-flags.json'
		},
		[
			{
				name: 'a harness program with no other commands',
				input: { program: 'harness', existingCommands: [] },
				output: { returnedValue: returned ?? null, commands, options }
			}
		]
	);
});

test('Parses impact flags before running the action', async () => {
	const explicitArgs = ['--base', 'main', '--head', 'feature-x', '--runtime', 'wasm', '--json'];
	const explicit = await parseImpact(explicitArgs);
	const defaults = await parseImpact([]);

	expect(explicit).toEqual({ base: 'main', head: 'feature-x', runtime: 'wasm', json: true });
	expect(defaults).toEqual({ base: 'HEAD' });
	recordExampleCases(
		{
			unitId: 'command.impact',
			symbol: 'registerImpactCommand',
			state: 'parses-impact-flags-before-running-the-action',
			evidence: 'examples-cases',
			file: 'parses-impact-flags-before-running-the-action.json'
		},
		[
			{
				name: 'explicit base, head, runtime and json flags',
				input: { args: explicitArgs },
				output: explicit
			},
			{
				name: 'no flags, so base defaults to HEAD',
				input: { args: [] },
				output: defaults
			}
		]
	);
});

test('Throws runImpact rejection when base is missing', async () => {
	const args = ['--base', MISSING_BASE];
	const failure = await withTempRepo((repository) => runImpactInRepo(repository.root, args));

	expect(failure).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'command.impact',
			symbol: 'registerImpactCommand',
			state: 'throws-runimpact-rejection-when-base-is-missing',
			evidence: 'examples-cases',
			file: 'throws-runimpact-rejection-when-base-is-missing.json'
		},
		[
			{
				name: 'base revision that does not exist in a fresh repository',
				input: { args },
				error: { name: failure instanceof Error ? failure.name : typeof failure }
			}
		]
	);
});
