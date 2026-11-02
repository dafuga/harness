import { expect, test } from 'vitest';
import { indexFiles, unitOf } from '../support/memoryTree';
import { readUid, uidComment, withUid } from '../../src/utils/development-tooling/unitUid';

const uid = 'u_abcdefghij';
const component = (extra = '') =>
	`<!-- @harness-tier atom -->\n<!-- @harness-uid ${uid} -->\n<hx-p>Hi${extra}</hx-p>\n`;

test('a uid is read from the first lines of svelte, script and style files, and only from there', () => {
	expect(readUid(component())).toBe(uid);
	expect(readUid(`// @harness-uid ${uid}\nexport const a = 1;`)).toBe(uid);
	expect(readUid(`/* @harness-uid ${uid} */\n.a{}`)).toBe(uid);
	expect(readUid(`${'x\n'.repeat(600)}// @harness-uid ${uid}`)).toBeUndefined();
	expect(readUid('// @harness-uid u_short')).toBeUndefined();
	expect(readUid(`// @harness-uid ${uid}x`)).toBeUndefined();
});

test('the annotation goes after a shebang or the harness comments and is added only once', () => {
	expect(uidComment('a.json', uid)).toBeUndefined();
	expect(withUid('a.json', '{}', uid)).toBe('{}');
	const script = withUid('run.ts', '#!/usr/bin/env bun\nconsole.log(1);\n', uid);
	expect(script).toBe(`#!/usr/bin/env bun\n// @harness-uid ${uid}\nconsole.log(1);\n`);
	const svelte = withUid('A.svelte', '<!-- @harness-tier atom -->\n<hx-p />\n', uid);
	expect(svelte.split('\n').slice(0, 2)).toEqual([
		'<!-- @harness-tier atom -->',
		`<!-- @harness-uid ${uid} -->`
	]);
	expect(withUid('A.svelte', svelte, 'u_zzzzzzzzzz')).toBe(svelte);
});

test('a new annotated unit keeps its uid and an unannotated one has none', async () => {
	const indexed = await indexFiles({
		'src/components/Card.svelte': component(),
		'src/components/Plain.svelte': '<!-- @harness-tier atom -->\n<hx-p>Plain</hx-p>\n'
	});
	expect(unitOf(indexed, 'component.card').uid).toBe(uid);
	expect(unitOf(indexed, 'component.plain').uid).toBeUndefined();
});

test('moving or renaming an annotated file keeps its unit, id, contract and companions', async () => {
	const before = await indexFiles({
		'src/utils/format.ts': `// @harness-uid ${uid}\nexport function format(value: string): string {\n\treturn value;\n}\n`,
		'src/utils/format.types.ts': 'export interface Format { a: string }\n'
	});
	const unit = unitOf(before, 'function.format');
	const declared = {
		...unit,
		responsibility: 'Formats a value.',
		responsibilityOrigin: 'declared' as const
	};
	const after = await indexFiles(
		{
			'src/utils/text/renamed.ts': `// @harness-uid ${uid}\nexport function format(value: string): string {\n\treturn value;\n}\n`,
			'src/utils/text/renamed.types.ts': 'export interface Format { a: string }\n'
		},
		[declared]
	);
	expect(after.result.manifests.map((manifest) => manifest.id)).toEqual(['function.format']);
	expect(after.result.added).toEqual([]);
	expect(after.result.moved).toEqual([
		{ id: 'function.format', from: 'src/utils/format.ts', to: 'src/utils/text/renamed.ts' }
	]);
	const moved = unitOf(after, 'function.format');
	expect(moved.responsibility).toBe('Formats a value.');
	expect(moved.owns.source).toEqual([
		'src/utils/text/renamed.ts',
		'src/utils/text/renamed.types.ts'
	]);
	expect(moved.uid).toBe(uid);
});

test('a forwarding entry and its implementation share one uid and one unit across a move', async () => {
	const note = `// @harness-uid ${uid}\n`;
	const impl = (path: string) => ({
		[path]: `${note}export function cut(a: string): string {\n\treturn a;\n}\n`
	});
	const entry = { 'src/utils/cut.ts': `${note}export { cut } from './impl/cut';\n` };
	const first = await indexFiles({ ...entry, ...impl('src/utils/impl/cut.ts') });
	expect(unitOf(first, 'function.cut').owns.source).toEqual([
		'src/utils/cut.ts',
		'src/utils/impl/cut.ts'
	]);
	const second = await indexFiles(
		{
			'src/utils/cut.ts': `${note}export { cut } from './text/cut';\n`,
			...impl('src/utils/text/cut.ts')
		},
		first.result.manifests
	);
	expect(second.result.manifests.map((manifest) => manifest.id)).toEqual(['function.cut']);
	expect(second.result.added).toEqual([]);
	expect(unitOf(second, 'function.cut').owns.source).toEqual([
		'src/utils/cut.ts',
		'src/utils/text/cut.ts'
	]);
});

test('files without a uid keep the earlier path and symbol behavior', async () => {
	const files = {
		'src/utils/same.ts': 'export function same(a: string): string {\n\treturn a;\n}\n'
	};
	const first = await indexFiles(files);
	const again = await indexFiles(files, first.result.manifests);
	expect(again.result.added).toEqual([]);
	expect(again.result.updated).toEqual([]);
});
