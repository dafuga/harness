import { test } from 'vitest';
import {
	relatedReviewPaths,
	reviewConventionPaths
} from '../../src/audit/development-tooling/cleanCodeRelated';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each operation of the cleanCodeRelated audit rule is called the way the rule calls it, with
 * made-up project paths and source text. What it was given and what it returned is asserted and
 * recorded as the cases of its state.
 */

const related = (name: string, target: string, code: string, files: string[]) => ({
	name,
	input: { target, code, files },
	output: relatedReviewPaths(target, code, files)
});

const convention = (name: string, target: string) => ({
	name,
	input: { target },
	output: reviewConventionPaths(target)
});

const fixed = ['AGENTS.md', '.codex/skills/harness/SKILL.md', 'harness.audit.json'];
const runFiles = [
	'src/reports/run.ts',
	'src/reports/parser.ts',
	'src/format/row.ts',
	'src/reports/run.test.ts',
	'src/reports/format.ts'
];
const cartFiles = [
	'src/lib/cart/Cart.svelte',
	'src/lib/cart/totals.ts',
	'src/lib/format.ts',
	'src/lib/cart/Cart.test.ts'
];
const billingFiles = [
	'app/services/billing.py',
	'app/services/models.py',
	'app/core/money.py',
	'app/services/test_billing.py'
];

test('relatedReviewPaths resolved TypeScript and Svelte imports', () => {
	const typescript = related(
		'a TypeScript file with relative and parent imports, and its test',
		'src/reports/run.ts',
		"import { parseReport } from './parser';\nimport { formatRow } from '../format/row';\n\nexport function run(input: string) {\n    return formatRow(parseReport(input));\n}\n",
		runFiles
	);
	const svelte = related(
		'a Svelte component with $lib imports, and its test',
		'src/lib/cart/Cart.svelte',
		"<script lang=\"ts\">\n    import { totals } from '$lib/cart/totals';\n    import { formatPrice } from '$lib/format';\n</script>\n",
		cartFiles
	);
	const bare = related(
		'a bare package import, not matched to a listed file, beside a relative import',
		'src/reports/run.ts',
		"import { z } from 'zod';\nimport { parseReport } from './parser';\n",
		['src/reports/run.ts', 'src/reports/parser.ts', 'src/zod.ts']
	);
	const alias = related(
		'a TypeScript file that imports through the @/ alias',
		'src/reports/run.ts',
		"import { row } from '@/format/row';\n",
		['src/reports/run.ts', 'src/format/row.ts']
	);
	expect(typescript.output).toEqual([
		'src/reports/parser.ts',
		'src/format/row.ts',
		'src/reports/run.test.ts'
	]);
	expect(svelte.output).toEqual([
		'src/lib/cart/totals.ts',
		'src/lib/format.ts',
		'src/lib/cart/Cart.test.ts'
	]);
	expect(bare.output).toEqual(['src/reports/parser.ts']);
	expect(alias.output).toEqual(['src/format/row.ts']);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-related',
			symbol: 'relatedReviewPaths',
			state: 'relatedreviewpaths-resolved-typescript-and-svelte-imports',
			evidence: 'examples-cases',
			file: 'relatedreviewpaths-resolved-typescript-and-svelte-imports.json'
		},
		[typescript, svelte, bare, alias]
	);
});

test('relatedReviewPaths resolved Python relative imports', () => {
	const sibling = related(
		'a Python file with a same-folder and a parent-package import, and its test_ file',
		'app/services/billing.py',
		'from .models import Invoice\nfrom ..core.money import round_cents\n\n\ndef total(items):\n    return sum(items)\n',
		billingFiles
	);
	const unlisted = related(
		'a Python import of a module that is not in the file list',
		'app/services/billing.py',
		'from .models import Invoice\n',
		['app/services/billing.py', 'app/services/test_billing.py']
	);
	expect(sibling.output).toEqual([
		'app/services/models.py',
		'app/core/money.py',
		'app/services/test_billing.py'
	]);
	expect(unlisted.output).toEqual(['app/services/test_billing.py']);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-related',
			symbol: 'relatedReviewPaths',
			state: 'relatedreviewpaths-resolved-python-relative-imports',
			evidence: 'examples-cases',
			file: 'relatedreviewpaths-resolved-python-relative-imports.json'
		},
		[sibling, unlisted]
	);
});

test('relatedReviewPaths capped imports at four and tests at two', () => {
	const capped = related(
		'six imports, one of them not in the file list, and three test files',
		'src/reports/run.ts',
		"import { x } from './x';\nimport { a } from './a';\nimport { b } from './b';\nimport { c } from './c';\nimport { d } from './d';\nimport { e } from './e';\n",
		[
			'src/reports/run.ts',
			'src/reports/a.ts',
			'src/reports/b.ts',
			'src/reports/c.ts',
			'src/reports/d.ts',
			'src/reports/e.ts',
			'src/reports/run.test.ts',
			'test/reports/run.spec.ts',
			'src/reports/run.spec.ts'
		]
	);
	const short = related(
		'two imports and one test file, all of them returned',
		'src/reports/run.ts',
		"import { a } from './a';\nimport { b } from './b';\n",
		['src/reports/run.ts', 'src/reports/a.ts', 'src/reports/b.ts', 'src/reports/run.test.ts']
	);
	expect(capped.output).toEqual([
		'src/reports/a.ts',
		'src/reports/b.ts',
		'src/reports/c.ts',
		'src/reports/d.ts',
		'src/reports/run.test.ts',
		'test/reports/run.spec.ts'
	]);
	expect(short.output).toEqual(['src/reports/a.ts', 'src/reports/b.ts', 'src/reports/run.test.ts']);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-related',
			symbol: 'relatedReviewPaths',
			state: 'relatedreviewpaths-capped-imports-at-four-and-tests-at-two',
			evidence: 'examples-cases',
			file: 'relatedreviewpaths-capped-imports-at-four-and-tests-at-two.json'
		},
		[capped, short]
	);
});

test('reviewConventionPaths walked folders up to the root', () => {
	const nested = convention('a file in a folder two levels below the root', 'src/reports/run.ts');
	const deep = convention(
		'a file six folders deep, capped at seven entries',
		'packages/api/src/routes/v2/users/handlers.ts'
	);
	const root = convention('a file at the root, with only the fixed entries', 'run.ts');
	expect(nested.output).toEqual([...fixed, 'src/reports/AGENTS.md', 'src/AGENTS.md']);
	expect(deep.output).toEqual([
		...fixed,
		'packages/api/src/routes/v2/users/AGENTS.md',
		'packages/api/src/routes/v2/AGENTS.md',
		'packages/api/src/routes/AGENTS.md',
		'packages/api/src/AGENTS.md'
	]);
	expect(root.output).toEqual(fixed);
	recordExampleCases(
		{
			unitId: 'audit.clean-code-related',
			symbol: 'reviewConventionPaths',
			state: 'reviewconventionpaths-walked-folders-up-to-the-root',
			evidence: 'examples-cases',
			file: 'reviewconventionpaths-walked-folders-up-to-the-root.json'
		},
		[nested, deep, root]
	);
});
