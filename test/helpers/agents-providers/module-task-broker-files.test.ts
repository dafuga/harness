import { describe, expect, test } from 'vitest';
import { moduleTaskBrokerFiles } from '../../../src/helpers/agents-providers/moduleTaskBrokerFiles';

describe('moduleTaskBrokerFiles', () => {
	test('trims surrounding whitespace', () => {
		// => 'label'
		expect(moduleTaskBrokerFiles('  label  ')).toEqual('label');
	});

	test('returns blank for whitespace-only input', () => {
		// => ''
		expect(moduleTaskBrokerFiles('   ')).toEqual('');
	});

	test('rejects non-text input', () => {
		// throws 'moduleTaskBrokerFiles expects text'
		expect(() => moduleTaskBrokerFiles(42 as never)).toThrow('moduleTaskBrokerFiles expects text');
	});
});
