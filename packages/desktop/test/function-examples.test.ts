import { expect, test } from 'vitest';
import {
	callRows,
	calls,
	compared,
	elsewhere,
	gaps,
	malformed,
	observed,
	observedRows,
	rows,
	stored,
	unavailable,
	unit,
	words
} from '../../reports/test/artifactCaseDocs';
import type { BehaviorCell } from '../../reports/src/utils/entityBehavior';
import EntityCard from '../src/components/EntityCard.svelte';
import RuntimeArtifact from '../src/components/RuntimeArtifact.svelte';
import type { Workspace } from '../src/lib/stores/workspace.svelte';
import type { CatalogEntity } from '../src/models/Desktop.types';
import { workspaceRoute } from '../src/utils/workspaceRoute';
import { drawn } from './evidence-fixture';

/**
 * A function in the workspace: its recorded results as rows of input and observed output, a
 * sentence where there is none to show, and no design picture on its card or at its address.
 */
const artifact = (cell: BehaviorCell, scope?: string, lost = false) =>
	drawn(RuntimeArtifact, { cell, label: 'trace of cases', lost, unit: scope });

test('each recorded call of a function is a row: its input, then the output or the error observed', () => {
	const body = artifact(stored(calls), unit);
	expect(rows(body)).toEqual(callRows);
	expect(words(body)).toContain('Calls of composeModes');
	expect(words(body)).not.toMatch(/Actual output|design/i);
});

test('a result that states an input and an output is one row, said to be what a test observed', () => {
	const body = artifact(stored(observed), unit);
	expect(rows(body)).toEqual(observedRows);
	expect(words(body)).toContain('What a test observed end to end');
	expect(words(body)).toContain('Matching order is listed');
	expect(rows(body).flat().join()).not.toMatch(/expected|found|12/);
	expect(words(body)).not.toContain('Actual output');
});

test('what an assertion expected and found is never a row, and what is malformed or of another unit says so', () => {
	const none = artifact(stored(compared), unit);
	expect([rows(none), words(none).includes(gaps.none)]).toEqual([[], true]);
	expect(words(none)).toContain('Total matches');
	for (const [position, document] of malformed.entries()) {
		const body = artifact(stored(document), unit);
		expect([position, rows(body)]).toEqual([position, []]);
		expect(words(body), String(position)).toContain(gaps.malformed);
	}
	const other = artifact(stored(elsewhere), unit);
	expect([rows(other), words(other).includes(gaps.elsewhere)]).toEqual([[], true]);
});

test('a result that is absent, not stored, unread or not what its hash says shows no row', () => {
	for (const [name, [cell, why]] of Object.entries(unavailable)) {
		const body = artifact(cell, unit);
		expect([name, rows(body)]).toEqual([name, []]);
		expect(words(body), name).toContain(why);
	}
	expect(words(artifact(unavailable.unread[0], unit, true))).toContain(
		'It could not be read and checked against its hash.'
	);
});

test('outside a function a recorded result is the same row, and nothing is said of a function', () => {
	const body = artifact(stored(observed));
	expect(rows(body)).toEqual(observedRows);
	expect(words(body)).toContain('What a test observed end to end.');
	expect(words(body)).not.toMatch(/Actual output|this function/);
	expect(words(body)).toContain('Matching order is listed');
});

const listed = (change: Partial<CatalogEntity>): CatalogEntity => ({
	id: 'function.filter',
	category: 'functions',
	kind: 'function',
	title: 'filterOrders',
	summary: 'Returns the orders whose name matches a search.',
	changed: false,
	planned: false,
	hasPlan: false,
	lifecycle: null,
	verification: 'unknown',
	verificationNote: 'Not loaded.',
	latestVersion: null,
	approvedVersion: null,
	threadCount: 0,
	thumbnail: null,
	...change
});
const workspace = {
	bridge: null,
	snapshot: null,
	context: {},
	path: (category: string, id: string, suffix = '') =>
		`/harness/${category}/${id}${suffix ? `/${suffix}` : ''}`,
	navigate: async () => {}
} as unknown as Workspace;
const thumbnail = {
	version: 'v001',
	sha256: 'b'.repeat(64),
	state: 'default',
	viewport: 'desktop'
};
const card = (change: Partial<CatalogEntity>) =>
	drawn(EntityCard, { entity: listed(change), workspace });

test('the card of a function has no design picture or placeholder, and opens its plan', () => {
	const planned = card({ hasPlan: true, latestVersion: 'v001', thumbnail });
	expect(words(planned)).not.toMatch(/design/i);
	expect(planned).not.toContain('class="thumbnail"');
	expect(planned).toContain('href="/harness/functions/function.filter/plan"');
	expect(words(planned)).toContain('Review plan');
	const plain = card({});
	expect(words(plain)).not.toMatch(/design/i);
	expect(plain).toContain('href="/harness/functions/function.filter"');
	expect(plain).toContain('aria-label="Open filterOrders"');
	expect(words(plain)).toContain('filterOrders');
});

test('the card of a planned page keeps its design picture and its designs link', () => {
	const page = { id: 'page.orders', category: 'pages', kind: 'page', title: 'OrdersPage' } as const;
	expect(words(card(page))).toContain('No screenshot recorded');
	expect(words(card({ ...page, hasPlan: true }))).toContain('No design image yet');
	const planned = card({ ...page, hasPlan: true, latestVersion: 'v001', thumbnail });
	expect(planned).toMatch(/class="thumbnail(?:\s[^"]*)?"/);
	expect(planned).toContain('href="/harness/pages/page.orders/designs"');
});

test('the plan of an entity has an address, and the address of designs is still read', () => {
	const at = (suffix: string) =>
		workspaceRoute(`/harness/branch/main/functions/function.filter/${suffix}`).suffix;
	expect([at('plan'), at('designs')]).toEqual(['plan', 'designs']);
});
