import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { changedUnits } from '../../src/utils/git-source-history/changedUnits';

const state = (title: string) =>
	title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);

function record(title: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'desktop.function.changed-units',
			symbol: 'changedUnits',
			state: state(title),
			evidence: 'examples-cases',
			file: `${state(title)}.json`
		},
		cases
	);
}

/** A synthetic owner lookup: paths missing from the table have no owner. */
const lookup =
	(table: Record<string, string[]>) =>
	(path: string): string[] =>
		table[path] ?? [];

test('Names each owning unit once in sorted order', () => {
	const paths = ['src/b.ts', 'src/a.ts'];
	const owners = lookup({
		'src/b.ts': ['app.function.beta'],
		'src/a.ts': ['app.function.beta', 'app.function.alpha']
	});
	const said = changedUnits(paths, owners);
	expect(said).toBe('Units changed: [[unit:app.function.alpha]], [[unit:app.function.beta]].');
	expect(said).not.toContain('src/');
	record('Names each owning unit once in sorted order', [
		{ name: 'two paths share one owner', input: { paths }, output: said }
	]);
});

test('Counts repeated unowned paths without naming them', () => {
	const paths = ['docs/notes.md', 'docs/notes.md', 'scratch/private-name.ts'];
	const said = changedUnits(paths, lookup({}));
	expect(said).toBe('3 files outside any unit.');
	expect(said).not.toContain('private-name');
	record('Counts repeated unowned paths without naming them', [
		{ name: 'three unowned paths, one repeated', input: { paths }, output: said }
	]);
});

test('Ignores invalid owner ids without counting them as outside', () => {
	const onlyInvalid = changedUnits(['src/x.ts'], () => ['Not.An.Id', 'UPPER.case']);
	const mixed = changedUnits(['src/y.ts'], () => ['Not.An.Id', 'app.function.one']);
	expect(onlyInvalid).toBe('');
	expect(mixed).toBe('Units changed: [[unit:app.function.one]].');
	record('Ignores invalid owner ids without counting them as outside', [
		{ name: 'only invalid ids give no notice', input: { path: 'src/x.ts' }, output: onlyInvalid },
		{ name: 'valid id kept beside invalid id', input: { path: 'src/y.ts' }, output: mixed }
	]);
});

test('Caps named units at forty and counts the rest', () => {
	const paths = Array.from({ length: 45 }, (_, n) => `f${n}.ts`);
	const owners = lookup(Object.fromEntries(paths.map((path, n) => [path, [`app.function.f${n}`]])));
	const said = changedUnits(paths, owners);
	expect(said.match(/\[\[unit:/g)).toHaveLength(40);
	expect(said.endsWith(', and 5 more.')).toBe(true);
	record('Caps named units at forty and counts the rest', [
		{
			name: 'forty-five owned paths',
			input: { count: paths.length },
			output: { named: 40, rest: 5, said }
		}
	]);
});

test('Yields no notice for a change with no paths', () => {
	const said = changedUnits([], lookup({}));
	expect(said).toBe('');
	record('Yields no notice for a change with no paths', [
		{ name: 'empty change list', input: { paths: [] }, output: said }
	]);
});
