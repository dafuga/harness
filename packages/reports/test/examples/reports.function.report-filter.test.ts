import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportFilter } from '../../src/components/verification-evidence/evidence-grid/reportFilter';
import { screenSize, galleryEvidence, projectFilter } from '../../src/utils/verification-evidence/reportFilter';
import type { Filters } from '../../src/utils/verification-evidence/reportFilter.types';

type Evidence = Parameters<typeof reportFilter>[0][number];
type Report = Parameters<typeof projectFilter>[0];
type Status = Evidence['status'];

const UNIT_ID = 'reports.function.report-filter';

function asStatus(value: string): Status {
	return value as Status;
}

function recordMeta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function ids(items: Array<{ id: string }>) {
	return items.map((item) => item.id);
}

function shot(id: string, fields: Partial<Evidence> = {}): Evidence {
	return {
		id,
		title: id,
		category: 'screens',
		file: `${id}.png`,
		status: asStatus('passed'),
		mediaType: 'image',
		phase: 'after',
		...fields
	};
}

function audio(id: string, phase: 'before' | 'after', fields: Partial<Evidence> = {}): Evidence {
	return shot(id, {
		phase,
		mediaType: 'audio',
		file: `${id}.m4a`,
		mimeType: 'audio/mp4',
		...fields
	});
}

function filter(overrides: Partial<Filters> = {}): Filters {
	return { search: '', category: '', phase: '', status: '', ...overrides };
}

function report(project: string, title: string, summary: string): Report {
	return {
		schemaVersion: 1,
		id: `${project}-run`,
		project: { id: project, name: `${project} app`, path: `/fixtures/${project}` },
		title,
		mode: 'feature',
		environment: 'local',
		historical: false,
		startedAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:05:00.000Z',
		summary,
		status: asStatus('passed'),
		state: 'finalized',
		checks: [],
		evidence: [],
		findings: [],
		coverage: [],
		acceptance: []
	};
}

test('Classifies viewports by known words before numeric widths', () => {
	const viewports = [
		'iPhone 14',
		'iPad landscape',
		'Laptop 1440',
		'Desktop 390',
		'699 px',
		'700 px',
		'1099 px',
		'1100 px',
		'wide screen',
		''
	];
	const sizes = viewports.map((viewport) => screenSize(shot('viewport', { viewport })));
	expect(sizes).toEqual([
		'mobile',
		'tablet',
		'desktop',
		'desktop',
		'mobile',
		'tablet',
		'tablet',
		'desktop',
		'other',
		'other'
	]);
	recordExampleCases(
		recordMeta('screenSize', 'classifies-viewports-by-known-words-before-numeric-widths'),
		viewports.map((viewport, index) => ({
			name: `viewport "${viewport}"`,
			input: { viewport },
			output: sizes[index]
		}))
	);
});

test('Gallery hides before images and paired before audio', () => {
	const items = [
		shot('after-shot'),
		shot('before-shot', { phase: 'before' }),
		audio('before-audio-paired', 'before'),
		audio('after-audio', 'after'),
		audio('before-audio-unpaired', 'before')
	];
	const pairs = new Map([['after-audio', items[2]]]);
	const shown = ids(galleryEvidence(items, pairs));
	expect(shown).toEqual(['after-shot', 'after-audio', 'before-audio-unpaired']);
	recordExampleCases(
		recordMeta('galleryEvidence', 'gallery-hides-before-images-and-paired-before-audio'),
		items.map((item) => ({
			name: `${item.id} in gallery`,
			input: {
				phase: item.phase,
				mediaType: item.mediaType,
				pairedWithAfter: [...pairs.values()].some((before) => before.id === item.id)
			},
			output: shown.includes(item.id)
		}))
	);
});

test('Matches a report item when its paired before item passes', () => {
	const loginBefore = shot('login-before', {
		phase: 'before',
		category: 'login',
		status: asStatus('passed'),
		title: 'Login before fix',
		order: 1
	});
	const loginAfter = shot('login-after', {
		category: 'login',
		status: asStatus('failed'),
		title: 'Login after fix',
		order: 3
	});
	const checkout = shot('checkout-after', { category: 'checkout', order: 2 });
	const items = [loginAfter, checkout, loginBefore];
	const query = filter({ search: 'login', category: 'login', status: 'passed' });
	const pairs = new Map([['login-after', loginBefore]]);
	const withPairs = ids(reportFilter(items, query, pairs));
	const withoutPairs = ids(reportFilter(items, query));
	expect(withPairs).toEqual(['login-before', 'login-after']);
	expect(withoutPairs).toEqual(['login-before']);
	recordExampleCases(recordMeta('reportFilter', 'matches-a-report-item-when-its-paired-before-item-passes'), [
		{
			name: 'after item fails status but its before pair passes',
			input: { items: ids(items), filter: query, pairs: { 'login-after': 'login-before' } },
			output: withPairs
		},
		{
			name: 'same items without a pair map',
			input: { items: ids(items), filter: query },
			output: withoutPairs
		}
	]);
});

test('Searches all text fields and sorts by order', () => {
	const items = [
		shot('dashboard', { note: 'Uses the Toolbar', viewport: 'Mobile 390' }),
		shot('sidebar', { title: 'Sidebar', source: 'toolbar-spec.ts', order: 5 }),
		shot('form', { title: 'Form', transcript: 'opens the toolbar menu', order: 1 }),
		shot('footer', { title: 'Footer', order: 4 })
	];
	const toolbar = ids(reportFilter(items, filter({ search: 'TOOLBAR' })));
	const mobile = ids(reportFilter(items, filter({ search: 'mobile' })));
	expect(toolbar).toEqual(['dashboard', 'form', 'sidebar']);
	expect(mobile).toEqual(['dashboard']);
	recordExampleCases(recordMeta('reportFilter', 'searches-all-text-fields-and-sorts-by-order'), [
		{
			name: 'search "TOOLBAR" matches note, transcript and source',
			input: { items: ids(items), filter: { search: 'TOOLBAR' } },
			output: toolbar
		},
		{
			name: 'search "mobile" matches viewport',
			input: { items: ids(items), filter: { search: 'mobile' } },
			output: mobile
		}
	]);
});

test('Selects projects by id and case-insensitive query', () => {
	const alpha = report('alpha', 'Login flow', 'Checks sign in');
	const beta = report('beta', 'Checkout', 'Login used in cart');
	const rows: Array<{ name: string; run: Report; query: string; project: string }> = [
		{ name: 'uppercase query matches title', run: alpha, query: 'LOGIN', project: '' },
		{ name: 'other project id rejects match', run: alpha, query: 'login', project: 'beta' },
		{ name: 'query matches summary of selected project', run: beta, query: 'login', project: 'beta' },
		{ name: 'query with trailing space is not trimmed', run: beta, query: 'cart ', project: '' },
		{ name: 'project name text is searchable', run: alpha, query: 'alpha app', project: '' }
	];
	const results = rows.map((row) => projectFilter(row.run, row.query, row.project));
	expect(results).toEqual([true, false, true, false, true]);
	recordExampleCases(
		recordMeta('projectFilter', 'selects-projects-by-id-and-case-insensitive-query'),
		rows.map((row, index) => ({
			name: row.name,
			input: { run: row.run.id, query: row.query, project: row.project },
			output: results[index]
		}))
	);
});
