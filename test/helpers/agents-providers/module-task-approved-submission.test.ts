import { describe, expect, test } from 'vitest';
import { moduleTaskApprovedSubmission } from '../../../src/helpers/agents-providers/moduleTaskApprovedSubmission';

describe('moduleTaskApprovedSubmission', () => {
	test('trims surrounding whitespace', () => {
		// => 'label'
		expect(moduleTaskApprovedSubmission('  label  ')).toEqual('label');
	});

	test('returns blank for whitespace-only input', () => {
		// => ''
		expect(moduleTaskApprovedSubmission('   ')).toEqual('');
	});

	test('rejects non-text input', () => {
		// throws 'moduleTaskApprovedSubmission expects text'
		expect(() => moduleTaskApprovedSubmission(42 as never)).toThrow(
			'moduleTaskApprovedSubmission expects text'
		);
	});
});
