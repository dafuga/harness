import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { kernelRequest } from '../../src/utils/execution-runtimes/impact-kernel/kernelRequest';
import { isObject } from '../../src/utils/execution-runtimes/kernelRequest';

const validInput = {
	base: { nodes: ['node-a'], edges: [], ignored: true },
	head: { nodes: ['node-a', 'node-b'], edges: [[0, 1]], ignored: true },
	changed: ['node-b'],
	uncertain: [],
	sinks: ['node-b'],
	extra: 'ignored'
};

test('Accepts a valid impact request and removes extra fields', () => {
	const result = kernelRequest(validInput);
	expect(result).toEqual({
		value: {
			base: { nodes: ['node-a'], edges: [] },
			head: { nodes: ['node-a', 'node-b'], edges: [[0, 1]] },
			changed: ['node-b'],
			uncertain: [],
			sinks: ['node-b']
		}
	});
	recordExampleCases(
		{
			unitId: 'function.kernel-request',
			symbol: 'kernelRequest',
			state: 'accepts-a-valid-impact-request-and-removes-extra-fields',
			evidence: 'examples-cases',
			file: 'accepts-a-valid-impact-request-and-removes-extra-fields.json'
		},
		[{ name: 'valid graphs and string arrays with extras', input: validInput, output: result }]
	);
});

test('Reports malformed shapes before graph integrity errors', () => {
	const malformed = kernelRequest({
		base: { nodes: [], edges: [] },
		head: { nodes: [], edges: [] },
		changed: [1],
		uncertain: [],
		sinks: []
	});
	const repeated = kernelRequest({
		base: { nodes: ['same', 'same'], edges: [[9, 9]] },
		head: { nodes: [], edges: [] },
		changed: [],
		uncertain: [],
		sinks: []
	});
	expect(malformed).toEqual({
		error: { code: 'invalid-request', message: 'impact input field "changed" is malformed' }
	});
	expect(repeated).toEqual({
		error: { code: 'invalid-graph', message: 'base graph repeats node "same"' }
	});
	recordExampleCases(
		{
			unitId: 'function.kernel-request',
			symbol: 'kernelRequest',
			state: 'reports-malformed-shapes-before-graph-integrity-errors',
			evidence: 'examples-cases',
			file: 'reports-malformed-shapes-before-graph-integrity-errors.json'
		},
		[
			{
				name: 'changed must be a string array',
				input: { ...validInput, changed: [1] },
				output: malformed
			},
			{
				name: 'repeated node takes precedence over invalid edge',
				input: { ...validInput, base: { nodes: ['same', 'same'], edges: [[9, 9]] } },
				output: repeated
			}
		]
	);
});

test('Recognizes non-array objects regardless of prototype', () => {
	const values = [{ key: 'value' }, null, [], 'text'];
	const results = values.map(isObject);
	expect(results).toEqual([true, false, false, false]);
	recordExampleCases(
		{
			unitId: 'function.kernel-request',
			symbol: 'isObject',
			state: 'recognizes-non-array-objects-regardless-of-prototype',
			evidence: 'examples-cases',
			file: 'recognizes-non-array-objects-regardless-of-prototype.json'
		},
		values.map((input, index) => ({
			name: `object guard example ${index + 1}`,
			input,
			output: results[index]
		}))
	);
});
