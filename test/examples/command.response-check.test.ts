import { Command, CommanderError, type Option } from 'commander';
import { test } from 'vitest';
import { registerResponseCheckCommand } from '../../src/cli/program/ResponseCheckCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * registerResponseCheckCommand is called on a program named as buildProgram names it. Its action
 * runs only through commander: a pre-action hook on the root records the parsed options and throws,
 * so the real check, which would read files and call JEV, never runs. Help and refused input stop
 * in commander before that hook. Registration stores nothing, so no temporary directory is used.
 */

/** A program whose output is captured and whose exits are thrown instead of made. */
function harnessProgram(printed: string[]): Command {
	return new Command()
		.name('harness')
		.exitOverride()
		.configureOutput({
			writeOut: (text) => {
				printed.push(text);
			},
			writeErr: (text) => {
				printed.push(text);
			},
			getOutHelpWidth: () => 80,
			getErrHelpWidth: () => 80
		});
}

/** Registers the command on a program that already holds the named commands. */
function registered(existing: string[]) {
	const root = harnessProgram([]);
	for (const name of existing) root.command(name);
	const returned: unknown = registerResponseCheckCommand(root);
	return { root, returned };
}

function optionOf(option: Option) {
	return { flags: option.flags, description: option.description, default: option.defaultValue };
}

/** A command as its callers read it: its name, description and options with their defaults. */
function shape(command: Command) {
	return {
		name: command.name(),
		description: command.description(),
		options: command.options.map(optionOf)
	};
}

function commandNamed(program: Command, name: string): Command {
	const found = program.commands.find((command) => command.name() === name);
	if (!found) throw new Error(`no ${name} command`);
	return found;
}

function names(program: Command): string[] {
	return program.commands.map((command) => command.name());
}

/** A registration as a recorded case: the existing commands, what came back, the command's shape. */
function registrationCase(name: string, existing: string[]) {
	const { root, returned } = registered(existing);
	return {
		name,
		input: { program: 'harness', existing },
		output: {
			returnedType: typeof returned,
			programCommands: names(root),
			command: shape(commandNamed(root, 'response-check'))
		}
	};
}

/**
 * Parses argv against a program that holds the command. The pre-action hook records the options the
 * action would receive, then throws so the action body never runs. Help and refused input never
 * reach the hook: commander stops them, and its error is returned as the stop.
 */
async function dispatch(argv: string[]) {
	const printed: string[] = [];
	const root = harnessProgram(printed);
	registerResponseCheckCommand(root);
	const stopped = new Error('stopped before the response-check action ran');
	let reached: unknown;
	let stop: CommanderError | undefined;
	root.hook('preAction', (_program, action) => {
		reached = { action: action.name(), options: action.opts() };
		throw stopped;
	});
	try {
		await root.parseAsync(argv, { from: 'user' });
	} catch (error) {
		if (error instanceof CommanderError) stop = error;
		else if (error !== stopped) throw error;
	}
	return { argv, printed, reached, stop };
}

/** Invokes the response-check command with the given arguments after its name. */
function invoke(...args: string[]) {
	return dispatch(['response-check', ...args]);
}

/** One dispatch as a recorded case: the options the action received, the help, or the refusal. */
function caseOf(
	name: string,
	run: Awaited<ReturnType<typeof dispatch>>
): Parameters<typeof recordExampleCases>[1][number] {
	const { argv, printed, reached, stop } = run;
	if (stop?.code === 'commander.helpDisplayed')
		return {
			name,
			input: argv,
			output: { exitCode: stop.exitCode, help: printed.join('').trimEnd().split('\n') }
		};
	if (stop)
		return {
			name,
			input: argv,
			error: { code: stop.code, exitCode: stop.exitCode, message: stop.message }
		};
	return { name, input: argv, output: reached };
}

const requestFiles = ['--request', 'request.txt', '--response', 'answer.txt'];

/** The options a run with only the two files parses to: the registered defaults plus the files. */
const defaultOptions = {
	request: 'request.txt',
	response: 'answer.txt',
	model: 'jev-1.13.0',
	minConfidence: '0.85',
	apiKeyEnv: 'HARNESS_JEV_API_KEY'
};

test('registerResponseCheckCommand adds the response-check command', () => {
	const alone = registered([]);
	const beside = registered(['status']);
	const check = shape(commandNamed(alone.root, 'response-check'));
	expect(alone.returned).toBeUndefined();
	expect(names(alone.root)).toEqual(['response-check']);
	expect(names(beside.root)).toEqual(['status', 'response-check']);
	expect(check.description).toBe('Check whether an LLM answer follows a user request using JEV.');
	expect(check.options.map((option) => option.flags)).toEqual([
		'--loop <name>',
		'--step <id>',
		'--task <id>',
		'--agent-model <name>',
		'--report <id>',
		'--request <file>',
		'--response <file>',
		'--context <file>',
		'--criteria <file>',
		'--model <model>',
		'--min-confidence <number>',
		'--api-key-env <name>',
		'--gate',
		'--json',
		'--dry-run'
	]);
	const defaults = check.options.filter((option) => option.default !== undefined);
	expect(defaults.map((option) => [option.flags, option.default])).toEqual([
		['--model <model>', 'jev-1.13.0'],
		['--min-confidence <number>', '0.85'],
		['--api-key-env <name>', 'HARNESS_JEV_API_KEY']
	]);
	recordExampleCases(
		{
			unitId: 'command.response-check',
			symbol: 'registerResponseCheckCommand',
			state: 'registerresponsecheckcommand-adds-the-response-check-command',
			evidence: 'examples-cases',
			file: 'registerresponsecheckcommand-adds-the-response-check-command.json'
		},
		[
			registrationCase('a program named harness with no other commands', []),
			registrationCase('a program named harness that already has a status command', ['status'])
		]
	);
});

test('response-check reaches its action only for accepted input', async () => {
	const accepted = await invoke(...requestFiles);
	const gated = await invoke(...requestFiles, '--gate', '--json', '--min-confidence', '0.9');
	const dry = await invoke(...requestFiles, '--dry-run', '--agent-model', 'agent-example');
	const unknown = await invoke(...requestFiles, '--bogus');
	const missing = await invoke('--request');
	const help = await invoke('--help');
	expect(accepted.reached).toEqual({ action: 'response-check', options: defaultOptions });
	expect(gated.reached).toEqual({
		action: 'response-check',
		options: { ...defaultOptions, minConfidence: '0.9', gate: true, json: true }
	});
	expect(dry.reached).toEqual({
		action: 'response-check',
		options: { ...defaultOptions, dryRun: true, agentModel: 'agent-example' }
	});
	expect(unknown.stop?.code).toBe('commander.unknownOption');
	expect(unknown.stop?.message).toBe("error: unknown option '--bogus'");
	expect(missing.stop?.code).toBe('commander.optionMissingArgument');
	expect(missing.stop?.message).toBe("error: option '--request <file>' argument missing");
	expect(help.stop?.code).toBe('commander.helpDisplayed');
	expect(help.printed.join('')).toContain('(default: "0.85")');
	expect([unknown, missing, help].some((attempt) => attempt.reached !== undefined)).toBe(false);
	recordExampleCases(
		{
			unitId: 'command.response-check',
			symbol: 'registerResponseCheckCommand',
			state: 'response-check-reaches-its-action-only-for-accepted-input',
			evidence: 'examples-cases',
			file: 'response-check-reaches-its-action-only-for-accepted-input.json'
		},
		[
			caseOf('accepted files with the default options', accepted),
			caseOf('accepted run with gate, json and a stricter threshold', gated),
			caseOf('accepted run with dry run and an analytics link', dry),
			caseOf('an unknown option is refused before the action', unknown),
			caseOf('a missing value for --request is refused', missing),
			caseOf('--help prints the usage and stops before the action', help)
		]
	);
});
