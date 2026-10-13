import { expect, test, vi } from 'vitest';
import RuntimeBehavior from '../../src/components/RuntimeBehavior.svelte';
import { createEntityEvidenceStore } from '../../src/lib/stores/entityEvidence.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import { commits, drawn, evidenceBridge, ids, scopeOf, shownEvidence } from '../evidence-fixture';

const shown = async (id: string, commit: string | null, options = {}) => {
	const { store, result } = await shownEvidence(scopeOf(id, commit), options);
	return { store, result, body: drawn(RuntimeBehavior, { result, evidence: store }) };
};

test('a commit says that the behaviour changed, and where, once both results were read', async () => {
	const { body } = await shown(ids.filter, commits.tip);
	expect(body).toContain('End-to-end comparison');
	expect(body).toContain('<strong role="status">Behavior changed</strong>');
	expect(body).toContain('match: the recorded output changed at output[1]');
	expect(body).toContain('aria-label="Before · bbbbbbb"');
	expect(body).toContain('aria-label="After · ccccccc"');
	expect(body).toContain('passed → passed');
});

test('bytes that differ are no change while they are unread, and none when reading fails', async () => {
	const { bridge } = evidenceBridge();
	const never: DesktopBridge['artifact'] = () => new Promise(() => {});
	const store = createEntityEvidenceStore();
	const scope = scopeOf(ids.filter, commits.tip);
	store.show({ ...bridge, artifact: never }, { scope, planned: false, stamp: '' });
	await vi.waitFor(() => expect(store.status).toBe('ready'));
	const unread = drawn(RuntimeBehavior, { result: store.result!, evidence: store });
	expect(unread).toContain('<strong role="status">Reading the recorded results…</strong>');
	expect(unread).not.toMatch(/Behavior (un)?changed/);
	const output = store.result!.behavior.rows.find((row) => row.kind === 'output')!.after!;
	const damaged = await shown(ids.filter, commits.tip, { corrupt: [output.sha256] });
	expect(damaged.body).toContain('<strong role="status">Behavior unknown</strong>');
	expect(damaged.body).not.toContain('Behavior changed');
});

test('a branch tip and a first commit are one run; nothing recorded is said to be nothing', async () => {
	const tip = await shown(ids.filter, null);
	expect(tip.body).toContain('Current end-to-end behavior');
	expect(tip.body).toContain('<strong role="status">Current behavior</strong>');
	expect(tip.body).toContain('aria-label="Current snapshot · ccccccc"');
	expect(tip.body).not.toMatch(/Before ·|After ·/);
	const none = await shown(ids.settings, null);
	expect(none.body).toContain('No end-to-end result is recorded');
	expect(none.body).toContain('No end-to-end result is recorded for this entity at ccccccc.');
});
