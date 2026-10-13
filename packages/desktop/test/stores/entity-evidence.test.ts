import { afterEach, expect, test, vi } from 'vitest';
import { mediaFile } from '../../../reports/src/utils/harnessEvidence';
import {
	createEntityEvidenceStore,
	type EntityEvidence
} from '../../src/lib/stores/entityEvidence.svelte';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import { damagedArtifact } from '../../src/utils/artifactBytes';
import {
	commits,
	data,
	evidenceBridge,
	ids,
	refusal,
	scopeOf,
	shownEvidence
} from '../evidence-fixture';

const target = (entity: string, commit: string | null = null, stamp = '') => ({
	scope: scopeOf(entity, commit),
	planned: false,
	stamp
});
const settled = (store: EntityEvidence) =>
	vi.waitFor(() => {
		if (store.status === 'loading') throw new Error('still loading');
	});
const tick = () => new Promise((done) => setTimeout(done, 20));
/** A gate a test opens when it lets a held answer go. */
function gate() {
	let open!: () => void;
	const closed = new Promise<void>((release) => (open = release));
	return { closed, open };
}
afterEach(() => vi.restoreAllMocks());

test('evidence is read once for what is shown, and again when the scope or the pins change', async () => {
	const { bridge, calls } = evidenceBridge();
	const store = createEntityEvidenceStore();
	store.show(bridge, target(ids.page));
	expect(store.status).toBe('loading');
	await settled(store);
	expect(store.result?.scope.mode).toBe('current');
	store.show(bridge, target(ids.page));
	store.show(bridge, target(ids.page, commits.tip));
	await settled(store);
	expect(store.result?.scope).toMatchObject({ mode: 'commit', parent: commits.middle });
	store.show(bridge, target(ids.page, commits.tip, 'notes moved'));
	await settled(store);
	const asked = calls.filter((call) => call.op === 'evidence').map((call) => call.mode);
	expect(asked).toEqual(['current', 'commit', 'commit']);
});

test('an answer that arrives after another target is shown is dropped', async () => {
	const { bridge } = evidenceBridge();
	const late = gate();
	const evidence: DesktopBridge['evidence'] = async (input) => {
		if (input.mode === 'current') await late.closed;
		return bridge.evidence!(input);
	};
	const store = createEntityEvidenceStore();
	store.show({ ...bridge, evidence }, target(ids.page));
	store.show({ ...bridge, evidence }, target(ids.page, commits.middle));
	await settled(store);
	expect(store.result?.scope.commit).toBe(commits.middle);
	late.open();
	await tick();
	expect(store.result?.scope).toMatchObject({ mode: 'commit', commit: commits.middle });
});

test('a planned entity and a bridge without the read ask for nothing; a failure keeps its words', async () => {
	const { bridge, calls } = evidenceBridge();
	const store = createEntityEvidenceStore();
	store.show(bridge, { ...target(ids.page), planned: true });
	expect(store.status).toBe('planned');
	store.show({} as DesktopBridge, target(ids.page));
	expect(store.status).toBe('unavailable');
	expect(calls).toEqual([]);
	store.show(bridge, target('app.page.unknown'));
	await settled(store);
	const refused = 'No recorded evidence is bound to this address.';
	expect([store.status, store.error, store.result]).toEqual(['failed', refused, null]);
});

test('the bytes of a capture become one object URL, revoked when it is no longer shown', async () => {
	const made = vi.spyOn(URL, 'createObjectURL');
	const revoked = vi.spyOn(URL, 'revokeObjectURL');
	const { store, result, calls } = await shownEvidence(scopeOf(ids.page));
	const file = mediaFile(result.evidence.after.captures[0].capture);
	const url = await store.url('after', file);
	expect(url).toMatch(/^blob:/);
	expect(await store.url('after', file)).toBe(url);
	expect(calls.filter((call) => call.op === 'artifact')).toHaveLength(1);
	expect(made).toHaveBeenCalledTimes(1);
	await expect(store.url('before', file)).rejects.toThrow(/not listed/);
	store.reset();
	expect(revoked).toHaveBeenCalledWith(url);
	expect([store.status, store.result, store.read]).toEqual(['idle', null, undefined]);
});

test('damaged bytes never become an image, and bytes that arrive too late are let go', async () => {
	const made = vi.spyOn(URL, 'createObjectURL');
	const shot = data.results[`${ids.page}|current|${commits.tip}`].evidence.after.captures[0];
	const file = mediaFile(shot.capture);
	const damaged = await shownEvidence(scopeOf(ids.page), { corrupt: [shot.capture.sha256] });
	await expect(damaged.store.url('after', file)).rejects.toThrow(damagedArtifact);
	const { bridge } = evidenceBridge();
	const late = gate();
	const artifact: DesktopBridge['artifact'] = async (input) => {
		await late.closed;
		return bridge.artifact!(input);
	};
	const store = createEntityEvidenceStore();
	store.show({ ...bridge, artifact }, target(ids.page));
	await settled(store);
	const pending = store.url('after', file);
	store.reset();
	late.open();
	await expect(pending).rejects.toThrow(/no longer shown/);
	expect(made).not.toHaveBeenCalled();
});

test('the results of a function are read with its evidence: a change is known only then', async () => {
	const { store } = await shownEvidence(scopeOf(ids.filter, commits.tip));
	expect(store.result?.behavior.summary).toBe('differs');
	expect(store.read?.summary).toBe('changed');
	const output = store.result!.behavior.rows.find((row) => row.kind === 'output')!.after!;
	const refused = await shownEvidence(scopeOf(ids.filter, commits.tip), {
		refuse: [output.sha256]
	});
	expect(refused.store.read?.summary).toBe('unknown');
	expect(refused.store.refusals).toEqual({ [output.sha256]: refusal });
});
