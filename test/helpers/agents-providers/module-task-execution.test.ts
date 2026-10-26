import { describe, expect, test } from 'vitest';
import { moduleTaskExecution } from '../../../src/helpers/agents-providers/moduleTaskExecution';

describe('moduleTaskExecution', () => {
	test('trims surrounding whitespace', () => {
		// => 'label'
		expect(moduleTaskExecution('  label  ')).toEqual('label');
	});

	test('returns blank for whitespace-only input', () => {
		// => ''
		expect(moduleTaskExecution('   ')).toEqual('');
	});

	test('rejects non-text input', () => {
		// throws 'moduleTaskExecution expects text'
		expect(() => moduleTaskExecution(42 as never)).toThrow('moduleTaskExecution expects text');
	});
});
