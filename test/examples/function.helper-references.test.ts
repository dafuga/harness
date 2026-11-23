import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { helperReferences } from '../../src/services/explorer-ui/revision-detail-service/helperReferences';

const unitId = 'function.helper-references';

function callees(references: Array<{ specifier?: string; imported: string }>) {
	return references.map(({ specifier, imported }) => ({ specifier, imported }));
}

function record(state: string, cases: Array<{ name: string; input: unknown; output: unknown }>) {
	recordExampleCases(
		{
			unitId,
			symbol: 'helperReferences',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const slugifyCode =
	"import { slugify } from './slugify';\nexport function title() {\n\treturn slugify('Hello');\n}";
const constantCode = 'export const count = 1;';

const classCode = [
	"import { Store } from './store';",
	'export abstract class Cache extends Store {',
	'\tload() {}',
	'\tprivate hide() {}',
	'\tstatic make() {}',
	'}',
	'export const first = new Store();'
].join('\n');

const forwardCode = [
	"export { slugify as title } from './slugify';",
	"export * from './core';",
	'export default function main() {}',
	"export type { Shape } from './shape';"
].join('\n');

const namespaceCode = [
	"import type { Shape } from './shape';",
	"import * as lib from './lib';",
	'export const value: Shape = lib.make();',
	"export const pair = [lib['build'](), lib.make()];"
].join('\n');

test('Reports imported call references with their caller', () => {
	const facts = helperReferences(slugifyCode);
	const empty = helperReferences(constantCode);
	expect(callees(facts.references)).toEqual([{ specifier: './slugify', imported: 'slugify' }]);
	expect(empty.references).toEqual([]);
	record('reports-imported-call-references-with-their-caller', [
		{
			name: 'imports a function and calls it inside a function',
			input: { code: slugifyCode },
			output: { references: callees(facts.references) }
		},
		{
			name: 'file without imports reports no references',
			input: { code: constantCode },
			output: { references: [] }
		}
	]);
});

test('Marks construction sites and top-level class facts', () => {
	const facts = helperReferences(classCode);
	const constructs = callees(facts.references.filter((reference) => reference.construct));
	expect(constructs).toEqual([{ specifier: './store', imported: 'Store' }]);
	expect(facts.classes).toEqual([
		{
			name: 'Cache',
			abstract: true,
			methods: ['load'],
			base: { specifier: './store', imported: 'Store' }
		}
	]);
	record('marks-construction-sites-and-top-level-class-facts', [
		{
			name: 'abstract class extends an import and a new expression',
			input: { code: classCode },
			output: { constructs, classes: facts.classes }
		}
	]);
});

test('Lists export forwarding bindings from re-exports', () => {
	const facts = helperReferences(forwardCode);
	expect(facts.forwards).toEqual([
		{ name: 'title', imported: 'slugify', specifier: './slugify' },
		{ name: '*', imported: '*', specifier: './core' },
		{ name: 'default', imported: 'main' }
	]);
	record('lists-export-forwarding-bindings-from-re-exports', [
		{
			name: 'named, star and default exports; type-only export skipped',
			input: { code: forwardCode },
			output: { forwards: facts.forwards }
		}
	]);
});

test('Resolves namespace member reads and skips type imports', () => {
	const facts = helperReferences(namespaceCode);
	expect(callees(facts.references)).toEqual([
		{ specifier: './lib', imported: 'make' },
		{ specifier: './lib', imported: 'build' },
		{ specifier: './lib', imported: 'make' }
	]);
	record('resolves-namespace-member-reads-and-skips-type-imports', [
		{
			name: 'namespace property and literal index calls; type annotation ignored',
			input: { code: namespaceCode },
			output: { references: callees(facts.references) }
		}
	]);
});
