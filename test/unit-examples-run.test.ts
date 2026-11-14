import { expect, test } from 'vitest';
import type { UnitDocumentation, UsageExample } from '../src/utils/unit-documentation/unitDocumentation';
import { declaredExamples } from './support/unitExamples';
import {
	runDocumentedExamples,
	runHelperExamples,
	runUsageExample
} from './support/runUsageExample';

test('function.case helper examples pass', async () => {
	const { helpers } = declaredExamples('function.case');
	const observed = await Promise.all(
		helpers.map((helper) => runHelperExamples(helper, process.cwd()))
	);
	expect(observed.flat()).toHaveLength(12);
});

test('an example with a wrong output rejects', async () => {
	const example: UsageExample = {
		name: 'Wrong result',
		call: 'double(2)',
		input: [2],
		output: 5
	};
	await expect(runUsageExample(example, { double: (value: number) => value * 2 })).rejects.toThrow();
});

test('a throwing scope function matches its error example', async () => {
	const example: UsageExample = {
		name: 'Expected failure',
		call: 'fail()',
		input: [],
		error: 'failed'
	};
	const observed = await runUsageExample(example, {
		fail: () => {
			throw new Error('failed');
		}
	});
	expect(observed).toEqual({ name: example.name, input: example.input, error: 'failed' });
});

test('documented examples run after their setup and return observations', async () => {
	const doc: UnitDocumentation = {
		path: 'example.md',
		setup: 'const factor = 3',
		examples: [
			{ name: 'Scale the input', call: 'scale(factor)', input: [3], output: 9 }
		]
	};
	const observed = await runDocumentedExamples(doc, {
		scale: (value: number) => value * 3
	});
	expect(observed).toEqual([{ name: 'Scale the input', input: [3], output: 9 }]);
});

test('an example without a call throws', async () => {
	await expect(runUsageExample({ name: 'Missing call', input: [] }, {})).rejects.toThrow('has no call');
});
