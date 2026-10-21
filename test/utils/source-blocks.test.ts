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

test.each([
	{
		title: 'uninitialized class callbacks beside executable members',
		code: `export class Store {
	private release: (() => void) | undefined;
	onNavigate?: (target: string) => void;
	generic?: <T = unknown>(value: T) => T;
	run(flag: boolean) { if (flag) return 1; return 0; }
	set = (flag: boolean) => flag ? 1 : 0;
}`,
		members: [
			['Store.run', 2],
			['Store.set', 2]
		]
	},
	{
		title: 'initialized class callbacks with function type annotations',
		code: `export class Store {
	readonly convert: (value: boolean) => number = value => value ? 1 : 0;
	private identity: <T = unknown>(value: T) => T = value => value;
	read = function(flag: boolean) { if (flag) return 1; return 0; };
}`,
		members: [
			['Store.convert', 2],
			['Store.identity', 1],
			['Store.read', 2]
		]
	},
	{
		title: 'uninitialized variables and a typed executable constant',
		code: `let pending: (value: boolean) => boolean;
let generic: <T = unknown>(value: T) => T;
export const active: (value: boolean) => number = value => value ? 1 : 0;`,
		members: [['active', 2]]
	},
	{
		title: 'multiline and nested callback declarations',
		code: `class Store {
	onValue?: (
		value: { ok: boolean }
	) => void;
	callback: ((fn: () => void) => void) | undefined;
	apply = (flag: boolean) => { return flag ? 1 : 0; };
}`,
		members: [['Store.apply', 2]]
	}
])('sourceBlocks separates declarations and assigned values: $title', ({ code, members }) => {
	const blocks = sourceBlocks(code, 'ts');
	expect(blocks.map(({ name, complexity }) => [name, complexity])).toEqual([
		['<module>', 0],
		...members
	]);
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
