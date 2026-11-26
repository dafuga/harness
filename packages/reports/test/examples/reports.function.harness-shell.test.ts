import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { harnessShell, plainClick } from '../../src/utils/explorer-ui/harnessShell';
import type { HarnessNavbarInput } from '../../src/utils/explorer-ui/harnessShell';
import type { ExplorerLocation, ExplorerScope } from '../../src/models/explorer-ui/Explorer.types';
import type { HarnessRevisionSummary } from '../../src/models/explorer-ui/Harness.types';
import type { ModuleEntry } from '../../../../src/services/module-system/moduleDefinition.types';
import type { Cases } from './reports.function.harness-shell.test.types';
const unitId = 'reports.function.harness-shell';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
const commitA = 'a'.repeat(40),
	commitB = 'b'.repeat(40);
const href = (to: ExplorerLocation) =>
	`/reports/${to.branch ?? 'retained'}/${to.commit ?? 'tip'}/${to.category}` +
	(to.screen ? `/${to.screen}` : '');

const synthetic = {
	parents: [],
	subject: 'Synthetic change',
	author: 'Synthetic author',
	committedAt: '2026-01-01T00:00:00.000Z',
	coverage: 'verified' as const,
	gaps: [],
	records: [],
	legacy: []
};

function summary(commit: string, branches: string[], retained = false): HarnessRevisionSummary {
	return { ...synthetic, commit, branches, retained };
}

function scopeAt(commit: string, overrides: Partial<ExplorerScope> = {}): ExplorerScope {
	return {
		location: { branch: 'main', commit, category: 'pages' },
		mode: 'commit',
		branch: 'main',
		tip: commitA,
		commit,
		atTip: commit === commitA,
		parent: null,
		summary: summary(commit, ['main']),
		...overrides
	};
}

function input(overrides: Partial<HarnessNavbarInput> = {}): HarnessNavbarInput {
	return {
		base: '/reports',
		repository: 'synthetic',
		scope: null,
		index: null,
		commits: [],
		href,
		onroute: () => {},
		...overrides
	};
}

function resource(id: string, title: string, catalog?: string) {
	return { id, title, singular: title, kind: id, instructions: ['Synthetic.'], files: [], catalog };
}

function entry(
	id: string,
	order: number | undefined,
	resources: ReturnType<typeof resource>[],
	options: { installed?: boolean; testing?: boolean } = {}
): ModuleEntry {
	const testing = options.testing ? { headless: true, script: 'synthetic' } : undefined;
	const installed = options.installed ?? true;
	return {
		definition: { id, order, testing, resources },
		source: 'project',
		installed,
		instances: []
	} as unknown as ModuleEntry;
}

const plain = (view: unknown) => JSON.parse(JSON.stringify(view)) as unknown;

test('Without a scope the bar keeps the brand on base and categories inactive', () => {
	const view = harnessShell(input({ scope: null }));
	expect(view.home).toEqual({ href: '/reports', to: null });
	expect(view.categories.map((item) => [item.label, item.active, item.href, item.to])).toEqual([
		['Pages', false, null, null],
		['Code', false, null, null],
		['Translations', false, null, null],
		['Platforms', false, null, null]
	]);
	expect(view.modules).toEqual([]);
	expect(view.revision).toBeNull();
	record('harnessShell', 'without-a-scope-keeps-brand-on-base', [
		{ name: 'no scope', input: { scope: null }, output: plain(view) }
	]);
});

test('A scope on a branch links the brand to its tip and marks Pages active', () => {
	const scope = scopeAt(commitA);
	const view = harnessShell(input({ scope }));
	expect(view.home).toEqual({
		href: '/reports/main/tip/pages',
		to: { branch: 'main', commit: null, category: 'pages' }
	});
	expect(view.categories[0]).toMatchObject({
		id: 'pages',
		active: true,
		href: `/reports/main/${commitA}/pages`
	});
	expect(view.revision).toMatchObject({
		branch: 'main',
		commit: commitA,
		viewed: 'Selected commit · branch tip'
	});
	record('harnessShell', 'scope-links-brand-to-branch-tip', [
		{ name: 'branch scope at its tip', input: { scope }, output: plain(view) }
	]);
});

test('A retained commit without a branch keeps the brand on base and no tip', () => {
	const scope = scopeAt(commitB, {
		location: { branch: null, commit: commitB, category: 'pages' },
		branch: null,
		tip: null,
		atTip: false,
		summary: summary(commitB, [], true)
	});
	const view = harnessShell(input({ scope }));
	expect(view.home).toEqual({ href: '/reports', to: null });
	expect(view.revision).toMatchObject({
		branch: 'Retained commits',
		note: 'No branch tip',
		viewed: 'Retained commit',
		tip: null
	});
	expect(view.categories[0]).toMatchObject({ id: 'pages', active: true });
	record('harnessShell', 'retained-scope-without-branch-keeps-brand-on-base', [
		{ name: 'retained commit', input: { scope }, output: plain(view) }
	]);
});

test('Code destinations follow module order and skip testing and uninstalled modules', () => {
	const modules = {
		gaps: [],
		modules: [
			entry('alpha', undefined, [resource('notes', 'Notes')]),
			entry('beta', 10, [resource('library', 'Library', 'module-library')]),
			entry('gamma', 20, [resource('hidden', 'Hidden')], { testing: true }),
			entry('delta', 5, [resource('off', 'Off')], { installed: false })
		]
	};
	const view = harnessShell(input({ scope: scopeAt(commitA), modules }));
	expect(view.modules.map((item) => [item.id, item.label])).toEqual([
		['module-library', 'Plugins'],
		['resource:alpha.notes', 'Notes']
	]);
	expect(view.categories.find((item) => item.id === 'modules')).toMatchObject({
		to: { branch: 'main', commit: commitA, category: 'pages', screen: 'modules' },
		href: `/reports/main/${commitA}/pages/modules`
	});
	record('harnessShell', 'code-destinations-follow-module-order', [
		{ name: 'installed order 10 and unset', input: 'four entries', output: plain(view.modules) }
	]);
});

test('Revision controls list the viewed commit and link back to the tip', () => {
	const scope = scopeAt(commitA, { mode: 'commit', atTip: false, tip: commitB });
	const view = harnessShell(input({ scope, commits: [summary(commitB, ['main'])] }));
	const revision = view.revision!;
	expect(revision).toMatchObject({
		branch: 'main',
		commit: commitA,
		viewed: 'Historical commit',
		note: expect.stringMatching(/^Tip · /),
		tip: {
			href: '/reports/main/tip/pages',
			to: { branch: 'main', commit: null, category: 'pages' }
		}
	});
	expect(revision.commits.map((item) => item.commit)).toEqual([commitA, commitB]);
	const branchTo = revision.branchTo('feature');
	const commitTo = revision.commitTo(commitB);
	expect(branchTo).toEqual({ branch: 'feature', commit: null, category: 'pages' });
	expect(commitTo).toEqual({ branch: 'main', commit: commitB, category: 'pages' });
	record('harnessShell', 'revision-lists-viewed-commit-and-tip-link', [
		{
			name: 'historical commit with tip link',
			input: { scope },
			output: { ...(plain(view) as object), branchTo, commitTo }
		}
	]);
});

test('A plain click follows only an unmodified primary button that is not handled', () => {
	const primary = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
	const click = (fields: Partial<MouseEvent>) =>
		({ defaultPrevented: false, ...primary, ...fields }) as MouseEvent;
	const cases: Array<[string, Partial<MouseEvent>, boolean]> = [
		['primary plain', {}, true],
		['middle button', { button: 1 }, false],
		['secondary button', { button: 2 }, false],
		['meta key', { metaKey: true }, false],
		['control key', { ctrlKey: true }, false],
		['shift key', { shiftKey: true }, false],
		['alt key', { altKey: true }, false],
		['already prevented', { defaultPrevented: true }, false]
	];
	const outputs = cases.map(([, fields]) => plainClick(click(fields)));
	expect(outputs).toEqual(cases.map(([, , expected]) => expected));
	record(
		'plainClick',
		'plain-click-follows-only-unmodified-primary',
		cases.map(([name, fields], index) => ({ name, input: fields, output: outputs[index] }))
	);
});
