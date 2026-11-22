import type { Written, Stopped, Described, ExampleCase } from './command.activity.test.types';
import { Command, CommanderError, type Option } from 'commander';
import { test } from 'vitest';
import { registerActivityCommand } from '../../src/cli/program/ActivityCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * A program named as buildProgram names it. Output is captured and exits are thrown rather than
 * made; commander copies both into each subcommand created after they are set. The help width is
 * fixed so the recorded help does not depend on the terminal.
 */
function harnessProgram(written: Written): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({
			writeOut: (text) => {
				written.stdout.push(text);
			},
			writeErr: (text) => {
				written.stderr.push(text);
			},
			getOutHelpWidth: () => 80,
			getErrHelpWidth: () => 80
		});
}

/** Registers the activity command on a program that already holds the named commands. */
function registered(existing: string[]): { root: Command; activity: Command; written: Written } {
	const written: Written = { stdout: [], stderr: [] };
	const root = harnessProgram(written);
	for (const name of existing) root.command(name);
	return { root, activity: registerActivityCommand(root), written };
}

/** Parses argv against a fresh program and returns the commander stop that ended the parse. */
async function dispatch(argv: string[]): Promise<Stopped> {
	const written: Written = { stdout: [], stderr: [] };
	const root = harnessProgram(written);
	registerActivityCommand(root);
	try {
		await root.parseAsync(argv, { from: 'user' });
	} catch (error) {
		if (error instanceof CommanderError) return { written, stop: error };
		throw error;
	}
	throw new Error(`${argv.join(' ')} ran without commander stopping it`);
}

function optionOf(option: Option): Described['options'][number] {
	return option.defaultValue === undefined
		? { flags: option.flags }
		: { flags: option.flags, default: option.defaultValue };
}

/** A command as its callers read it: name, arguments, options with their defaults, subcommands. */
function described(command: Command): Described {
	return {
		name: command.name(),
		description: command.description(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map(optionOf),
		commands: command.commands.map(described)
	};
}

function subcommand(tree: Described, name: string): Described {
	const found = tree.commands.find((command) => command.name === name);
	if (!found) throw new Error(`${tree.name} has no ${name} subcommand`);
	return found;
}

/** One dispatch as a recorded case: the help commander printed, or the reason it refused. */
function outcome(name: string, input: string[], { written, stop }: Stopped): ExampleCase {
	if (stop.code === 'commander.helpDisplayed')
		return {
			name,
			input,
			output: { exitCode: stop.exitCode, help: written.stdout.join('').trimEnd().split('\n') }
		};
	return {
		name,
		input,
		error: { code: stop.code, exitCode: stop.exitCode, message: stop.message }
	};
}

test('registerActivityCommand added an activity command and five subcommands, then returned it', () => {
	const alone = registered([]);
	const beside = registered(['status']);
	const tree = described(alone.activity);
	expect(alone.activity.name()).toBe('activity');
	expect(alone.activity.description()).toBe(
		'What this repository is doing: recent work, checkouts and registered agents.'
	);
	expect(alone.root.commands.includes(alone.activity)).toBe(true);
	const names = tree.commands.map((command) => command.name);
	expect(names).toEqual(['show', 'register', 'heartbeat', 'finish', 'agents']);
	expect(subcommand(tree, 'show').options).toEqual([
		{ flags: '--limit <n>', default: '20' },
		{ flags: '--json' }
	]);
	expect(subcommand(tree, 'register').options).toContainEqual({
		flags: '--ttl <seconds>',
		default: '900'
	});
	expect(subcommand(tree, 'heartbeat').arguments).toEqual([{ name: 'id', required: true }]);
	expect(subcommand(tree, 'finish').arguments).toEqual([{ name: 'id', required: true }]);
	expect(beside.root.commands.map((command) => command.name())).toEqual(['status', 'activity']);
	expect(alone.written.stdout).toEqual([]);
	expect(alone.written.stderr).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.activity',
			symbol: 'registerActivityCommand',
			state: 'registeractivitycommand-added-an-activity-command-and-five-s',
			evidence: 'examples-cases',
			file: 'registeractivitycommand-added-an-activity-command-and-five-s.json'
		},
		[
			{
				name: 'a program named harness with no other commands',
				input: { program: 'harness', existing: [] },
				output: {
					returned: tree,
					programCommands: alone.root.commands.map((command) => command.name())
				}
			},
			{
				name: 'a program named harness that already has a status command',
				input: { program: 'harness', existing: ['status'] },
				output: {
					returned: described(beside.activity),
					programCommands: beside.root.commands.map((command) => command.name())
				}
			}
		]
	);
});

test('registerActivityCommand left subcommand help and refused input to commander, so no action ran', async () => {
	const showHelp = await dispatch(['activity', 'show', '--help']);
	const registerHelp = await dispatch(['activity', 'register', '--help']);
	const heartbeat = await dispatch(['activity', 'heartbeat']);
	const finish = await dispatch(['activity', 'finish', '--failed']);
	const agents = await dispatch(['activity', 'agents', '--bogus']);
	const shown = showHelp.written.stdout.join('');
	const registerShown = registerHelp.written.stdout.join('');
	expect(showHelp.stop.code).toBe('commander.helpDisplayed');
	expect(shown).toContain('Newest commits to show. (default: "20")');
	expect(registerShown).toContain('Seconds allowed between heartbeats. (default: "900")');
	expect(heartbeat.stop.message).toBe("error: missing required argument 'id'");
	expect(finish.stop.message).toBe("error: missing required argument 'id'");
	expect(agents.stop.message).toBe("error: unknown option '--bogus'");
	expect([heartbeat, finish, agents].map(({ written }) => written.stdout)).toEqual([[], [], []]);
	recordExampleCases(
		{
			unitId: 'command.activity',
			symbol: 'registerActivityCommand',
			state: 'registeractivitycommand-left-subcommand-help-and-refused-inp',
			evidence: 'examples-cases',
			file: 'registeractivitycommand-left-subcommand-help-and-refused-inp.json'
		},
		[
			outcome('show --help', ['activity', 'show', '--help'], showHelp),
			outcome('register --help', ['activity', 'register', '--help'], registerHelp),
			outcome('heartbeat without an id', ['activity', 'heartbeat'], heartbeat),
			outcome('finish --failed without an id', ['activity', 'finish', '--failed'], finish),
			outcome('agents with an unknown option', ['activity', 'agents', '--bogus'], agents)
		]
	);
});
