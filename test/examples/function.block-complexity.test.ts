import type { MaskedSource, ExampleCase, TemplateMarkup } from './function.block-complexity.test.types';
import { test } from 'vitest';
import { blockComplexity } from '../../src/utils/development-tooling/blockComplexity';
import { templateComplexity } from '../../src/services/development-tooling/source-index-service/blockComplexity';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/** Measures masked source as the complexity pass does; the input and the count are kept. */
function measured(name: string, input: MaskedSource): ExampleCase {
	return { name, input, output: blockComplexity(input.masked, input.base) };
}

/** Scans markup as the template pass does; the input and the count are kept. */
function scanned(name: string, input: TemplateMarkup): ExampleCase {
	return { name, input, output: templateComplexity(input.markup) };
}

test('blockComplexity counted whole-word decisions from a base', () => {
	const ternaryAndNullish = measured('if, &&, ?? and a ternary in a function with base 1', {
		masked: 'if (ready && fallback) return value ?? defaultValue; return active ? yes : no;',
		base: 1
	});
	const logicalOr = measured('a logical or in a declaration with base 0', {
		masked: 'const value = ready || fallback;',
		base: 0
	});
	const partialWords = measured('identifiers that only contain a keyword with base 1', {
		masked: 'const gift = format(iffy, forward, whiles, catches, cases);',
		base: 1
	});
	const loop = measured('a for loop and a catch clause with base 1', {
		masked: 'for (const item of items) { try { save(item); } catch (error) { report(error); } }',
		base: 1
	});
	expect(ternaryAndNullish.output).toBe(5);
	expect(logicalOr.output).toBe(1);
	expect(partialWords.output).toBe(1);
	expect(loop.output).toBe(3);
	recordExampleCases(
		{
			unitId: 'function.block-complexity',
			symbol: 'blockComplexity',
			state: 'blockcomplexity-counted-whole-word-decisions-from-a-base',
			evidence: 'examples-cases',
			file: 'blockcomplexity-counted-whole-word-decisions-from-a-base.json'
		},
		[ternaryAndNullish, logicalOr, partialWords, loop]
	);
});

test('blockComplexity skipped question marks of optional syntax', () => {
	const chaining = measured('optional chaining ?. is skipped', {
		masked: 'const name = user?.profile?.name;',
		base: 0
	});
	const parameters = measured(
		'optional parameter marks before a colon or a parenthesis are skipped',
		{
			masked: 'function label(flags?: string[], size?: number, hint?) {}',
			base: 0
		}
	);
	const nullish = measured('each ?? operator is counted once', {
		masked: 'return a ?? b ?? c;',
		base: 0
	});
	const ternary = measured('a ternary question mark is counted', {
		masked: 'return ready ? yes : no;',
		base: 0
	});
	expect(chaining.output).toBe(0);
	expect(parameters.output).toBe(0);
	expect(nullish.output).toBe(2);
	expect(ternary.output).toBe(1);
	recordExampleCases(
		{
			unitId: 'function.block-complexity',
			symbol: 'blockComplexity',
			state: 'blockcomplexity-skipped-question-marks-of-optional-syntax',
			evidence: 'examples-cases',
			file: 'blockcomplexity-skipped-question-marks-of-optional-syntax.json'
		},
		[chaining, parameters, nullish, ternary]
	);
});

test('templateComplexity counted each Svelte decision marker', () => {
	const example = scanned('if, else if, each and await markers in one template', {
		markup:
			'{#if ready}{:else if fallback}{/if}{#each items as item}{/each}{#await promise}{/await}'
	});
	const plain = scanned('plain text with no block markers', { markup: 'plain text' });
	const unclosed = scanned('an unclosed each and if block counts its opening markers', {
		markup: '<ul>{#each items as item}<li>{#if item.open}{item.name}'
	});
	const keyBlock = scanned('a key block and a plain else are not counted', {
		markup: '{#key id}{:else}{/key}'
	});
	expect(example.output).toBe(4);
	expect(plain.output).toBe(0);
	expect(unclosed.output).toBe(2);
	expect(keyBlock.output).toBe(0);
	recordExampleCases(
		{
			unitId: 'function.block-complexity',
			symbol: 'templateComplexity',
			state: 'templatecomplexity-counted-each-svelte-decision-marker',
			evidence: 'examples-cases',
			file: 'templatecomplexity-counted-each-svelte-decision-marker.json'
		},
		[example, plain, unclosed, keyBlock]
	);
});
