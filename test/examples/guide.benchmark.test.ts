import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { benchmarkGuide } from '../../src/guides/agents-providers/benchmark';

function ruleContaining(fragment: string): string {
	const found = benchmarkGuide.rules.find((rule) => rule.includes(fragment));
	expect(found).toBeDefined();
	return found ?? '';
}

test('Documents pinned defaults and explicit provider choice', () => {
	expect(benchmarkGuide.topic).toBe('benchmark');
	const defaults = ruleContaining('Default:');
	expect(defaults).toBe(
		'Default: three repetitions, fifteen minutes per trial and two repair submissions.'
	);
	const explicit = ruleContaining('Explicitly choose model and effort');
	expect(explicit).toContain('unsupported configurations never fall back');

	recordExampleCases(
		{
			unitId: 'guide.benchmark',
			symbol: 'benchmarkGuide',
			state: 'documents-pinned-defaults-and-explicit-provider-choice',
			evidence: 'examples-cases',
			file: 'documents-pinned-defaults-and-explicit-provider-choice.json'
		},
		[
			{
				name: 'trial defaults rule',
				input: { topic: benchmarkGuide.topic, rule: 'Default:' },
				output: defaults
			},
			{
				name: 'explicit provider rule',
				input: { rule: 'Explicitly choose model and effort' },
				output: explicit
			}
		]
	);
});

test('Lists the four benchmark commands in documented order', () => {
	const commands = benchmarkGuide.exampleCommands;
	expect(commands).toHaveLength(4);
	expect(commands[0]).toBe('harness benchmark validate benchmark.json');
	expect(commands.every((command) => command.startsWith('harness '))).toBe(true);

	recordExampleCases(
		{
			unitId: 'guide.benchmark',
			symbol: 'benchmarkGuide',
			state: 'lists-the-four-benchmark-commands-in-documented-order',
			evidence: 'examples-cases',
			file: 'lists-the-four-benchmark-commands-in-documented-order.json'
		},
		commands.map((command, index) => ({
			name: `command ${index + 1}`,
			input: { index },
			output: command
		}))
	);
});
