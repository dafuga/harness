import { expect, test } from 'vitest';
import RuntimeEvidence from '../../src/components/RuntimeEvidence.svelte';
import { createEntityEvidenceStore } from '../../src/lib/stores/entityEvidence.svelte';
import { createWorkspaceStore } from '../../src/lib/stores/workspace.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import { unavailableEvidence } from '../../src/utils/evidenceNotice';
import { commits, drawn, entityOf, ids, scopeOf, shownEvidence } from '../evidence-fixture';

const workspace = createWorkspaceStore();
const shown = async (id: string, commit: string | null = null) => {
	const { store } = await shownEvidence(scopeOf(id, commit));
	return drawn(RuntimeEvidence, { entity: entityOf(id), workspace, evidence: store });
};

test('a page is given its screenshot, named a runtime capture and never a design', async () => {
	const body = await shown(ids.page);
	expect(body).toContain('aria-label="Recorded runtime evidence"');
	expect(body).toContain('Runtime capture');
	expect(body).toContain('Branch tip · ccccccc');
	expect(body).toContain('Current screenshot');
	expect(body).not.toMatch(/end-to-end|Committed design|audio/i);
});

test('a function is given what it did, and no screenshot it never had', async () => {
	const body = await shown(ids.filter, commits.tip);
	expect(body).toContain('Commit ccccccc beside its parent bbbbbbb');
	expect(body).toContain('End-to-end comparison');
	expect(body).not.toMatch(/screenshot/i);
	expect(await shown(ids.filter, commits.first)).toContain('Commit aaaaaaa · first commit');
});

test('a component with a declared clip is given its screenshot and its audio', async () => {
	const body = await shown(ids.search);
	expect(body).toContain('Current screenshot');
	expect(body).toContain('Current audio');
});

test('what stands in place of evidence says why, and a saved copy is named as one', () => {
	const store = createEntityEvidenceStore();
	const entity = entityOf(ids.page);
	store.show({} as DesktopBridge, { scope: scopeOf(ids.page), planned: false, stamp: '' });
	expect(drawn(RuntimeEvidence, { entity, workspace, evidence: store })).toContain(
		unavailableEvidence
	);
	store.show(undefined, { scope: scopeOf(ids.page), planned: true, stamp: '' });
	expect(drawn(RuntimeEvidence, { entity, workspace, evidence: store })).toContain(
		'This page is planned and not implemented'
	);
	const offline = createWorkspaceStore();
	offline.offline = { cachedAt: null };
	expect(drawn(RuntimeEvidence, { entity, workspace: offline, evidence: store })).toContain(
		'Saved copy; not checked with the server.'
	);
});
