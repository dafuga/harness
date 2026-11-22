import { test } from 'vitest';
import { commandAction } from '../../src/utils/development-tooling/commandAction';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * commandAction is called with the CLI arguments that follow the executable and script names.
 * What each call returned, or the error it threw, is asserted and recorded as the cases of its
 * state.
 */

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

/** Calls commandAction with one set of arguments; an error it throws is kept by its name. */
function labelling(name: string, args: string[]): ExampleCase {
	try {
		return { name, input: args, output: commandAction(args) };
	} catch (error) {
		if (!(error instanceof Error)) throw error;
		return { name, input: args, error: { name: error.name } };
	}
}

test('Labels a top-level action and a listed subcommand', () => {
	const benchmark = labelling('a listed subcommand', ['benchmark', 'run']);
	const units = labelling('a listed subcommand with a later entry', ['units', 'index', '--json']);
	const action = labelling('a top-level action', ['response-check']);
	const generate = labelling('a top-level action with a following argument', [
		'generate',
		'component',
		'Button'
	]);
	expect(benchmark.output).toBe('benchmark run');
	expect(units.output).toBe('units index');
	expect(action.output).toBe('response-check');
	expect(generate.output).toBe('generate');
	recordExampleCases(
		{
			unitId: 'function.command-action',
			symbol: 'commandAction',
			state: 'labels-a-top-level-action-and-a-listed-subcommand',
			evidence: 'examples-cases',
			file: 'labels-a-top-level-action-and-a-listed-subcommand.json'
		},
		[benchmark, units, action, generate]
	);
});

test('Labels an unlisted or missing subcommand as help', () => {
	const missing = labelling('a command given with no subcommand', ['units']);
	const unlisted = labelling('a subcommand that the command does not list', [
		'benchmark',
		'deploy'
	]);
	const borrowed = labelling('a subcommand that only other commands list', ['task', 'run']);
	expect(missing.output).toBe('units help');
	expect(unlisted.output).toBe('benchmark help');
	expect(borrowed.output).toBe('task help');
	recordExampleCases(
		{
			unitId: 'function.command-action',
			symbol: 'commandAction',
			state: 'labels-an-unlisted-or-missing-subcommand-as-help',
			evidence: 'examples-cases',
			file: 'labels-an-unlisted-or-missing-subcommand-as-help.json'
		},
		[missing, unlisted, borrowed]
	);
});

test('Labels any other command name as help-or-unknown', () => {
	const unknown = labelling('a command the CLI does not know', ['deploy']);
	const none = labelling('an empty argument list, which is the command help', []);
	const empty = labelling('an empty command name', ['']);
	const similar = labelling('a name that only resembles an inherited one', ['constructors']);
	expect(unknown.output).toBe('help-or-unknown');
	expect(none.output).toBe('help-or-unknown');
	expect(empty.output).toBe('help-or-unknown');
	expect(similar.output).toBe('help-or-unknown');
	recordExampleCases(
		{
			unitId: 'function.command-action',
			symbol: 'commandAction',
			state: 'labels-any-other-command-name-as-help-or-unknown',
			evidence: 'examples-cases',
			file: 'labels-any-other-command-name-as-help-or-unknown.json'
		},
		[unknown, none, empty, similar]
	);
});

test('Throws a TypeError for an inherited Object.prototype name', () => {
	const cases = [
		labelling('the inherited constructor name', ['constructor']),
		labelling('the inherited __proto__ name', ['__proto__']),
		labelling('an inherited method name with a subcommand', ['toString', 'run']),
		labelling('the inherited valueOf method name', ['valueOf'])
	];
	expect(cases.map((item) => item.error)).toEqual([
		{ name: 'TypeError' },
		{ name: 'TypeError' },
		{ name: 'TypeError' },
		{ name: 'TypeError' }
	]);
	recordExampleCases(
		{
			unitId: 'function.command-action',
			symbol: 'commandAction',
			state: 'throws-a-typeerror-for-an-inherited-object-prototype-name',
			evidence: 'examples-cases',
			file: 'throws-a-typeerror-for-an-inherited-object-prototype-name.json'
		},
		cases
	);
});
