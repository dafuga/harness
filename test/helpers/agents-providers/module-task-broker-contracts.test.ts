import { describe, expect, test } from 'vitest';
import {
	moduleTaskBrokerContracts,
	projectBrokerContract
} from '../../../src/helpers/agents-providers/moduleTaskBrokerContracts';

describe('moduleTaskBrokerContracts', () => {
	test('trims surrounding whitespace', () => {
		// => 'label'
		expect(moduleTaskBrokerContracts('  label  ')).toEqual('label');
	});

	test('returns blank for whitespace-only input', () => {
		// => ''
		expect(moduleTaskBrokerContracts('   ')).toEqual('');
	});

	test('rejects non-text input', () => {
		// throws 'moduleTaskBrokerContracts expects text'
		expect(() => moduleTaskBrokerContracts(42 as never)).toThrow(
			'moduleTaskBrokerContracts expects text'
		);
	});
});

test('contract projection preserves authored examples without unrelated source or test paths', () => {
	const examples = [
		{
			nested: { values: [null, false, 0, '', { enabled: true }] },
			source: 'authored example data'
		},
		null,
		false,
		0
	];
	const field = { name: 'request', type: 'JSON', description: 'Authored example', examples };
	const contract = {
		inputs: [field],
		outputs: [{ ...field, name: 'result' }],
		errors: [{ ...field, name: 'failure' }]
	};
	const input = {
		manifest: {
			id: 'service.example',
			kind: 'service',
			title: 'Example',
			responsibility: 'Example contract',
			contract,
			owns: { source: ['src/private/implementation.ts'] },
			tests: ['test/private/implementation.test.ts'],
			dependencies: []
		},
		tests: ['test/private/outer.test.ts'],
		source: 'private implementation contents',
		consumers: []
	};
	const projected = projectBrokerContract(input, 'service.example');
	expect(projected).not.toHaveProperty('owns');
	expect(projected).not.toHaveProperty('source');
	expect(projected).not.toHaveProperty('tests');
	expect(JSON.stringify(projected)).not.toMatch(
		/src\/private|test\/private|private implementation contents/
	);
	expect(projected.contract).toEqual(contract);
	expect(input.manifest.contract).toEqual(contract);
});
