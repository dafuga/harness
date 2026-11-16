import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { helperTemplates } from '../../src/services/explorer-ui/revision-detail-service/helperTemplates';

test('Wraps template expressions for helper analysis', () => {
	const code = `<h1>{formatDate(date)}</h1>`;
	const output = helperTemplates(code);

	expect(output).toBe('function __template() { void (formatDate(date)); }');
	recordExampleCases(
		{
			unitId: 'function.helper-templates',
			symbol: 'helperTemplates',
			state: 'wraps-template-expressions-for-helper-analysis',
			evidence: 'examples-cases',
			file: 'wraps-template-expressions-for-helper-analysis.json'
		},
		[
			{
				name: 'template expression is wrapped with its referenced names',
				input: { code },
				output: 'function __template() { void (formatDate(date)); }'
			}
		]
	);
});
