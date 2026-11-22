import { Command, CommanderError } from 'commander';
import { test } from 'vitest';
import { analyticsOptions } from '../../src/utils/reports-media/analyticsOptions';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * analyticsOptions is called on a subcommand the way the CLI registers response-check and audit:
 * on program.command(name), with the command's own options chained after the five. Each case
 * records what the call was given and what came back, or the refusal commander gave when the
 * command was parsed. The function reads no file, so no temporary directory is needed. Exits are
 * thrown and output is discarded, so a refused parse neither exits the process nor prints.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

const unitId = 'function.analytics-options';
const symbol = 'analyticsOptions';
const evidence = 'examples-cases';

/** The five attribution options in declaration order, with the attribute commander stores each under. */
const attribution = [
	{ flags: '--loop <name>', attribute: 'loop' },
	{ flags: '--step <id>', attribute: 'step' },
	{ flags: '--task <id>', attribute: 'task' },
	{ flags: '--agent-model <name>', attribute: 'agentModel' },
	{ flags: '--report <id>', attribute: 'report' }
];

/** Every attribution option given a made-up value, in the order a caller would pass them. */
const everyValue = [
	'--loop',
	'release-check',
	'--step',
	'step-3',
	'--task',
	'task-42',
	'--agent-model',
	'claude-haiku-5-5',
	'--report',
	'report-7'
];

/** A program whose exits are thrown and whose output is discarded; subcommands inherit both. */
function harnessProgram(): Command {
	return new Command('harness').exitOverride().configureOutput({
		writeOut: () => undefined,
		writeErr: () => undefined
	});
}

function optionFlags(command: Command): string[] {
	return command.options.map((option) => option.flags);
}

/** The fields of a command that matter: whether the call returned it, its flags and any defaults. */
function described(command: Command, returned: Command) {
	return {
		sameCommand: returned === command,
		optionFlags: optionFlags(command),
		withDefault: command.options
			.filter((option) => option.defaultValue !== undefined)
			.map((option) => option.flags)
	};
}

/**
 * Parses argv against response-check as the CLI registers it. Returns the values commander stored
 * and the attributes it left unset, or the refusal it gave when it stopped the parse.
 */
function parsing(name: string, argv: string[]): ExampleCase {
	const program = harnessProgram();
	const check = analyticsOptions(program.command('response-check'));
	try {
		program.parse(['response-check', ...argv], { from: 'user' });
	} catch (error) {
		if (error instanceof CommanderError)
			return {
				name,
				input: { command: 'response-check', argv },
				error: { code: error.code, message: error.message }
			};
		throw error;
	}
	const stored = check.opts();
	const values = Object.fromEntries(
		attribution
			.filter(({ attribute }) => stored[attribute] !== undefined)
			.map(({ attribute }) => [attribute, stored[attribute]])
	);
	const unset = attribution
		.filter(({ attribute }) => stored[attribute] === undefined)
		.map(({ attribute }) => attribute);
	return { name, input: { command: 'response-check', argv }, output: { values, unset } };
}

test('analyticsOptions added five attribution options to a command and returned that same command', () => {
	const program = harnessProgram();
	const check = program.command('response-check');
	const audit = program.command('audit [path]');
	const returnedCheck = analyticsOptions(check);
	const chainedAudit = analyticsOptions(audit).option('--json', 'Print structured audit results.');
	expect(returnedCheck === check).toBe(true);
	expect(chainedAudit === audit).toBe(true);
	expect(optionFlags(check)).toEqual(attribution.map(({ flags }) => flags));
	expect(optionFlags(audit)).toEqual([...attribution.map(({ flags }) => flags), '--json']);
	expect(audit.options.some((option) => option.defaultValue !== undefined)).toBe(false);
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'analyticsoptions-added-five-attribution-options-to-a-command',
			evidence,
			file: 'analyticsoptions-added-five-attribution-options-to-a-command.json'
		},
		[
			{
				name: 'response-check with no option chained after the five',
				input: { parent: 'harness', command: 'response-check', chained: [] },
				output: described(check, returnedCheck)
			},
			{
				name: 'audit [path] with its own --json chained after the five',
				input: { parent: 'harness', command: 'audit [path]', chained: ['--json'] },
				output: described(audit, chainedAudit)
			}
		]
	);
});

test('analyticsOptions declared no defaults: a value that was not passed stayed unset and an option it did not declare was refused', () => {
	const given = parsing('all five attribution options given a value', everyValue);
	const partial = parsing('only --task given a value; the rest stayed unset', [
		'--task',
		'task-42'
	]);
	const none = parsing('no attribution option given; all five stayed unset', []);
	const undeclared = parsing('--owner, an option it did not declare, was refused', [
		'--owner',
		'release-team'
	]);
	expect(given.output).toEqual({
		values: {
			loop: 'release-check',
			step: 'step-3',
			task: 'task-42',
			agentModel: 'claude-haiku-5-5',
			report: 'report-7'
		},
		unset: []
	});
	expect(partial.output).toEqual({
		values: { task: 'task-42' },
		unset: ['loop', 'step', 'agentModel', 'report']
	});
	expect(none.output).toEqual({
		values: {},
		unset: ['loop', 'step', 'task', 'agentModel', 'report']
	});
	expect(undeclared.error).toEqual({
		code: 'commander.unknownOption',
		message: "error: unknown option '--owner'"
	});
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'analyticsoptions-declared-no-defaults-a-value-that-was-not-p',
			evidence,
			file: 'analyticsoptions-declared-no-defaults-a-value-that-was-not-p.json'
		},
		[given, partial, none, undeclared]
	);
});
