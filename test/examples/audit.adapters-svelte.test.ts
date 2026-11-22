import type { Audited } from './audit.adapters-svelte.test.types';
import { test } from 'vitest';
import { svelteAdapter } from '../../src/audit/development-tooling/adapters/svelte';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import { maskTemplateLiterals, splitLines } from '../../src/audit/development-tooling/commonRules';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const component = `<!-- @harness-tier molecule -->
<script lang="ts">
	let { label }: { label: string } = $props();
</script>
<Icon />{label}
`;
const page = `<!-- @harness-tier page -->
<script lang="ts">
	let { data } = $props();
</script>
<PageHeader title={data.title} />
`;
const typed = `<!-- @harness-tier molecule -->
<script lang="ts">type Props = { label: string }; let { label }: Props = $props();</script>
<Icon />{label}
`;
const untiered = '<script lang="ts">let label = 1;</script>\n<div>{label}</div>\n';
const counter = '<script lang="ts">let count = 0;</script>\n<button>{count}</button>\n';
const unlabelled = '<script>\n\tlet count = 0;\n</script>\n<p>{count}</p>\n';
const typesOnly = '<script lang="ts">export type Size = "sm" | "lg";</script>\n<p>Sizes</p>\n';
const five = 'function build(a: string, b: string, c: string, d: string, e: string) {}';
const four = 'function build(a: string, b: string, c: string, d: string) {}';
const firstFive = `<script lang="ts">\n${five}\n</script>\n`;
const firstFour = `<script lang="ts">\n${four}\n</script>\n`;
const secondFive = `<script lang="ts">let a = 1;</script>\n<script context="module" lang="ts">\n${five}\n</script>\n`;
const emptyFirst = `<script lang="ts"></script>\n<script context="module" lang="ts">\n${five}\n</script>\n`;
const rows = Array.from({ length: 230 }, (_, index) => `<p>${index}</p>`).join('\n');
const ledger = `<script lang="ts">let total = 0;</script>\n${rows}\n`;

/** The audit file the CLI builds for a Svelte source: the same derived lines and default limits. */
function svelteFile(relativePath: string, contents: string, extension: string): AuditFile {
	return {
		absolutePath: `/example/project/${relativePath}`,
		relativePath,
		extension,
		contents,
		lines: splitLines(contents),
		structuralLines: splitLines(maskTemplateLiterals(contents)),
		limits: harnessRuleLimits,
		size: Buffer.byteLength(contents)
	};
}

/** Audits one file with the real adapter; the case keeps the file it was given and the findings. */
function audited(
	name: string,
	relativePath: string,
	contents: string,
	extension = '.svelte'
): Audited {
	const file = svelteFile(relativePath, contents, extension);
	return { name, input: { relativePath, extension, contents }, output: svelteAdapter.audit(file) };
}

/** The rule names of each case's findings, in the order the adapter returned them. */
function rules(cases: Audited[]): string[][] {
	return cases.map(({ output }) => output.map(({ rule }) => rule));
}

test('svelteAdapter audit found no findings in conforming files', () => {
	const cases = [
		audited('Component: molecule tier and lang ts', 'src/components/Button.svelte', component),
		audited('Route page: page tier and a component', 'src/routes/+page.svelte', page),
		audited('Library file: lang ts and native markup', 'src/lib/Counter.svelte', counter)
	];
	expect(rules(cases)).toEqual([[], [], []]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-svelte',
			symbol: 'svelteAdapter.audit',
			state: 'svelteadapter-audit-found-no-findings-in-conforming-files',
			evidence: 'examples-cases',
			file: 'svelteadapter-audit-found-no-findings-in-conforming-files.json'
		},
		cases
	);
});

test('svelteAdapter audit flagged script blocks without lang ts', () => {
	const cases = [
		audited('Library script with no lang attribute', 'src/lib/Counter.svelte', unlabelled),
		audited('Library script with lang ts', 'src/lib/Counter.svelte', counter),
		audited('Library file with no script block', 'src/lib/Note.svelte', '<p>Note</p>\n')
	];
	expect(rules(cases)).toEqual([['svelte-script-lang'], [], []]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-svelte',
			symbol: 'svelteAdapter.audit',
			state: 'svelteadapter-audit-flagged-script-blocks-without-lang-ts',
			evidence: 'examples-cases',
			file: 'svelteadapter-audit-flagged-script-blocks-without-lang-ts.json'
		},
		cases
	);
});

test('svelteAdapter audit checked route and component file names', () => {
	const cases = [
		audited('Route file named Settings', 'src/routes/Settings.svelte', page),
		audited('Nested route file named +layout', 'src/routes/blog/+layout.svelte', page),
		audited('Component named icon-button', 'src/components/icon-button.svelte', component),
		audited('Component named Button2, with a digit', 'src/components/Button2.svelte', component)
	];
	expect(rules(cases)).toEqual([['svelte-route-file'], [], ['svelte-component-name'], []]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-svelte',
			symbol: 'svelteAdapter.audit',
			state: 'svelteadapter-audit-checked-route-and-component-file-names',
			evidence: 'examples-cases',
			file: 'svelteadapter-audit-checked-route-and-component-file-names.json'
		},
		cases
	);
});

test('svelteAdapter audit applied length, type and atomic rules', () => {
	const big = svelteFile('src/lib/Ledger.svelte', ledger, '.svelte');
	const cases = [
		{
			name: 'Library file the audit counts as 232 lines, over the 220 line limit',
			input: { relativePath: big.relativePath, extension: big.extension, lines: big.lines.length },
			output: svelteAdapter.audit(big)
		},
		audited('Component with a type beside runtime code', 'src/components/Chip.svelte', typed),
		audited('Component with no tier and a native div', 'src/components/Card.svelte', untiered),
		audited('Library script with only type declarations', 'src/lib/size.svelte', typesOnly)
	];
	expect(rules(cases)).toEqual([
		['small-file'],
		['separate-type-declarations'],
		['atomic-tier-required', 'atomic-native-element'],
		[]
	]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-svelte',
			symbol: 'svelteAdapter.audit',
			state: 'svelteadapter-audit-applied-length-type-and-atomic-rules',
			evidence: 'examples-cases',
			file: 'svelteadapter-audit-applied-length-type-and-atomic-rules.json'
		},
		cases
	);
});

test('svelteAdapter audit checked blocks in the first script only', () => {
	const cases = [
		audited('First script: a function of five parameters', 'src/lib/build.svelte', firstFive),
		audited('First script: a function of four parameters', 'src/lib/build.svelte', firstFour),
		audited('Second script only: five parameters', 'src/lib/build.svelte', secondFive),
		audited('Empty first script, five parameters after it', 'src/lib/build.svelte', emptyFirst)
	];
	expect(rules(cases)).toEqual([['max-parameters'], [], [], []]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-svelte',
			symbol: 'svelteAdapter.audit',
			state: 'svelteadapter-audit-checked-blocks-in-the-first-script-only',
			evidence: 'examples-cases',
			file: 'svelteadapter-audit-checked-blocks-in-the-first-script-only.json'
		},
		cases
	);
});

test('svelteAdapter audit declared profiles and audited any file', () => {
	expect(svelteAdapter).toMatchObject({
		id: 'svelte',
		label: 'Svelte',
		profiles: ['app', 'dapp'],
		extensions: ['.svelte'],
		optionalTools: ['svelte-check', 'eslint']
	});
	const cases = [
		audited('Text file with an unlabelled script', 'notes/scratch.txt', unlabelled, '.txt'),
		audited('TypeScript file with an unlabelled script', 'src/lib/store.ts', unlabelled, '.ts')
	];
	expect(rules(cases)).toEqual([['svelte-script-lang'], ['svelte-script-lang']]);
	recordExampleCases(
		{
			unitId: 'audit.adapters-svelte',
			symbol: 'svelteAdapter.audit',
			state: 'svelteadapter-audit-declared-profiles-and-audited-any-file',
			evidence: 'examples-cases',
			file: 'svelteadapter-audit-declared-profiles-and-audited-any-file.json'
		},
		cases
	);
});
