import { expect, test } from 'vitest';
import CoveragePanel from '../../src/components/CoveragePanel.svelte';
import { createEntityEvidenceStore } from '../../src/lib/stores/entityEvidence.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import { unavailableEvidence } from '../../src/utils/evidenceNotice';
import { commits, drawn, entityOf, ids, scopeOf, shownEvidence } from '../evidence-fixture';

const shown = async (id: string, commit: string | null = null) => {
	const { store } = await shownEvidence(scopeOf(id, commit));
	return drawn(CoveragePanel, { entity: entityOf(id), evidence: store });
};

test('each scenario is listed with its checks and its states as the record judges them', async () => {
	const body = await shown(ids.page);
	expect(body).toContain('aria-label="Evidence coverage"');
	expect(body).toContain('Recorded for ccccccc · record rec-cccccc-0000');
	expect(body).toContain('Orders page over synthetic orders');
	expect(body).toContain('orders-browser · passed');
	const row = (state: string) => body.slice(body.indexOf(`<td>${state}</td>`)).split('</tr>')[0];
	expect(row('default')).toContain('aria-label="passed"');
	expect(row('empty')).toMatch(/aria-label="failed[^"]*"/);
	expect(row('empty')).toContain('screens · screenshot · mobile: failed');
	expect(row('denied')).toContain('inapplicable');
});

test('an inherited result names where it came from, and a commit without a record says so', async () => {
	expect(await shown(ids.card)).toContain('Inherited from bbbbbbb');
	const first = await shown(ids.page, commits.first);
	expect(first).toContain('No verification record is attached to this commit.');
	expect(first).toMatch(/aria-label="missing[^"]*"/);
});

test('a connection that cannot read evidence says so here as well', () => {
	const store = createEntityEvidenceStore();
	store.show({} as DesktopBridge, { scope: scopeOf(ids.page), planned: false, stamp: '' });
	const body = drawn(CoveragePanel, { entity: entityOf(ids.page), evidence: store });
	expect(body).toContain(unavailableEvidence);
	expect(body).not.toContain('<table');
});
