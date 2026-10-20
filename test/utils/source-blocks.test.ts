import { expect, test } from 'vitest';
import { sourceBlocks } from '../../src/services/source-index-service/sourceBlocks';

const base = [
	"import { x } from './x';",
	'const limit = 3;',
	'export function alpha(value: number): number {',
	'\tif (value > limit && value < 9) return value;',
	"\treturn value ? x : '}';",
	'}',
	'export const beta = async (name: string) => {',
	'\tfor (const part of name) await x(part);',
	'};',
	'export class Gamma {',
	'\trun(input: string): string {',
	'\t\treturn input ?? `{${input}}`;',
	'\t}',
	'}',
	''
].join('\n');

test('sourceBlocks names functions, methods and the module remainder', () => {
	const blocks = sourceBlocks(base, 'ts');
	expect(blocks.map((block) => [block.name, block.kind, block.complexity])).toEqual([
		['<module>', 'module', 0],
		['alpha', 'function', 4],
		['beta', 'function', 2],
		['Gamma.run', 'method', 2]
	]);
	expect(blocks.find((block) => block.name === 'alpha')).toMatchObject({
		startLine: 3,
		endLine: 6
	});
});

test('sourceBlocks hashes change only for the edited block', () => {
	const hashes = (code: string) =>
		Object.fromEntries(sourceBlocks(code, 'ts').map((block) => [block.name, block.hash]));
	const before = hashes(base);
	const edited = hashes(base.replace('value < 9', 'value < 10'));
	const moduleEdited = hashes(base.replace('limit = 3', 'limit = 4'));

	expect(edited.alpha).not.toBe(before.alpha);
	expect({ ...edited, alpha: before.alpha }).toEqual(before);
	expect(moduleEdited['<module>']).not.toBe(before['<module>']);
	expect({ ...moduleEdited, '<module>': before['<module>'] }).toEqual(before);
	expect(hashes(`\n\n${base}`)).toEqual(before);
});

test('sourceBlocks separates Svelte script functions, template and style', () => {
	const svelte = [
		'<script lang="ts">',
		'\tfunction toggle(open: boolean): boolean {',
		'\t\treturn !open;',
		'\t}',
		'</script>',
		'{#if open}<p>Open</p>{/if}',
		'<style>',
		'\tp { color: red; }',
		'</style>'
	].join('\n');
	expect(sourceBlocks(svelte, 'svelte').map((block) => block.name)).toEqual([
		'<module>',
		'toggle',
		'<template>',
		'<style>'
	]);
});
