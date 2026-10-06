import { expect, test } from 'vitest';
import { buildProgram } from '../../src/cli/program';

test('response checker is registered with all public options', () => {
	const command = buildProgram().commands.find((item) => item.name() === 'response-check');
	expect(command).toBeDefined();
	expect(command?.options.map((item) => item.long)).toEqual([
		'--loop',
		'--step',
		'--task',
		'--agent-model',
		'--report',
		'--request',
		'--response',
		'--context',
		'--criteria',
		'--model',
		'--min-confidence',
		'--api-key-env',
		'--gate',
		'--json',
		'--dry-run'
	]);
});
