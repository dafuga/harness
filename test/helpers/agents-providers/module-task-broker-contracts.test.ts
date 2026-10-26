import { describe, expect, test } from 'vitest';
import { moduleTaskBrokerContracts } from '../../../src/helpers/agents-providers/moduleTaskBrokerContracts';

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
		expect(() => moduleTaskBrokerContracts(42 as never)).toThrow('moduleTaskBrokerContracts expects text');
	});
});
