import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { maskSource } from '../../src/utils/development-tooling/maskSource';

test('Masks comments and literal contents while preserving source', () => {
	const source = "const message = 'secret'; // comment\nsend(message);";
	const template = 'const view = `Hello ${user.name}`;';
	const preserved = maskSource(source, { strings: false });
	const masked = maskSource(source);
	const templateOutput = maskSource(template);
	const cases = [
		{
			name: 'default masks quoted contents and line comment',
			input: { code: source },
			output: masked
		},
		{
			name: 'false preserves literal contents but masks comments',
			input: { code: source, options: { strings: false } },
			output: preserved
		},
		{
			name: 'template contents are masked while interpolation remains code',
			input: { code: template },
			output: templateOutput
		}
	];

	expect(masked).toBe("const message = '      ';           \nsend(message);");
	expect(preserved).toBe("const message = 'secret';           \nsend(message);");
	expect(templateOutput).toBe('const view = `      ${user.name}`;');
	expect(masked).toHaveLength(source.length);
	expect(templateOutput).toHaveLength(template.length);
	recordExampleCases(
		{
			unitId: 'function.mask-source',
			symbol: 'maskSource',
			state: 'masks-comments-and-literal-contents-while-preserving-source',
			evidence: 'examples-cases',
			file: 'masks-comments-and-literal-contents-while-preserving-source.json'
		},
		cases
	);
});
