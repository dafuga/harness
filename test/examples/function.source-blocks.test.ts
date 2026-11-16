import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { sourceBlocks } from '../../src/services/development-tooling/source-index-service/sourceBlocks';
import type { SourceBlock } from '../../src/utils/development-tooling/sourceBlocks';

function summarize(blocks: SourceBlock[]) {
	return blocks.map(({ name, kind, startLine, endLine, hash, complexity }) => ({
		name,
		kind,
		startLine,
		endLine,
		hash,
		complexity
	}));
}

test('Splits TypeScript and Svelte source into named and remainder', () => {
	const empty = sourceBlocks('', 'ts');
	const tsInput = 'export function add(a: number, b: number): number {\n\treturn a + b;\n}';
	const tsOutput = summarize(sourceBlocks(tsInput, 'ts'));
	const svelteInput = '<script>let count = 0;</script>\n<p>{count}</p>\n<style>p { color: red; }</style>';
	const svelteOutput = summarize(sourceBlocks(svelteInput, 'svelte'));
	const cases = [
		{ name: 'empty TypeScript produces a module remainder', input: { code: '', language: 'ts' }, output: summarize(empty) },
		{ name: 'TypeScript retains a named function and remainder', input: { code: tsInput, language: 'ts' }, output: tsOutput },
		{ name: 'Svelte separates script, template and style', input: { code: svelteInput, language: 'svelte' }, output: svelteOutput }
	];

	expect(empty).toEqual([
		{ name: '<module>', kind: 'module', startLine: 1, endLine: 1, hash: 'e3b0c44298fc1c14', complexity: 0 }
	]);
	expect(tsOutput.some((block) => block.kind === 'function' && block.name === 'add')).toBe(true);
	expect(svelteOutput.map((block) => block.kind)).toEqual(['module', 'template', 'style']);
	recordExampleCases(
		{
			unitId: 'function.source-blocks',
			symbol: 'sourceBlocks',
			state: 'splits-typescript-and-svelte-source-into-named-and-remainder',
			evidence: 'examples-cases',
			file: 'splits-typescript-and-svelte-source-into-named-and-remainder.json'
		},
		cases
	);
});
