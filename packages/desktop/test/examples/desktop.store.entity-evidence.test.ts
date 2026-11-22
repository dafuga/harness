import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { mediaFile } from '../../../reports/src/utils/explorer-ui/harnessEvidence';
import {
	createEntityEvidenceStore,
	type EntityEvidence
} from '../../src/lib/stores/explorer-ui/entityEvidence.svelte';
import { commits, evidenceBridge, ids, scopeOf } from '../evidence-fixture';

const target = (entity: string, commit: string | null = null) => ({
	scope: scopeOf(entity, commit),
	planned: false,
	stamp: ''
});
const settled = (store: EntityEvidence) =>
	vi.waitFor(() => {
		if (store.status === 'loading') throw new Error('still loading');
	});
const snapshot = (store: EntityEvidence) => ({
	status: store.status,
	result: store.result,
	error: store.error,
	read: store.read,
	refusals: store.refusals
});

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'desktop.store.entity-evidence',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

afterEach(() => vi.restoreAllMocks());

test('Each call makes a separate store that starts idle, empty and unread', async () => {
	const { bridge, calls } = evidenceBridge();
	const first = createEntityEvidenceStore();
	const second = createEntityEvidenceStore();
	const initial = snapshot(first);
	expect(initial).toEqual({
		status: 'idle',
		result: null,
		error: '',
		read: undefined,
		refusals: {}
	});
	expect(snapshot(second)).toEqual(initial);
	expect(first).not.toBe(second);
	expect(calls).toEqual([]);
	first.show(bridge, target(ids.page));
	expect(first.status).toBe('loading');
	expect(second.status).toBe('idle');
	await settled(first);
	expect(second.result).toBeNull();
	recordCases('createEntityEvidenceStore', 'creates-separate-idle-stores', [
		{ name: 'first store before show', input: {}, output: initial },
		{ name: 'second store is untouched by the first show', input: {}, output: snapshot(second) },
		{ name: 'bridge reads after first show', input: {}, output: calls.length }
	]);
});

test('Reads no evidence until show, and url() refuses a capture before any target is shown', async () => {
	const { bridge, calls } = evidenceBridge();
	const store = createEntityEvidenceStore();
	await expect(store.url('after', 'missing.png')).rejects.toThrow(
		'This capture is not listed by the evidence that is shown.'
	);
	const readsBeforeShow = calls.length;
	expect(readsBeforeShow).toBe(0);
	store.show(bridge, target(ids.page));
	await settled(store);
	const readsAfterShow = calls.filter((call) => call.op === 'evidence').length;
	expect(readsAfterShow).toBe(1);
	recordCases('createEntityEvidenceStore', 'reads-nothing-until-shown', [
		{
			name: 'url before show refused',
			input: { side: 'after' },
			error: {
				name: 'EvidenceCaptureUnavailableError',
				message: 'This capture is not listed by the evidence that is shown.'
			}
		},
		{ name: 'evidence reads before show', input: {}, output: readsBeforeShow },
		{ name: 'evidence reads after show', input: {}, output: readsAfterShow }
	]);
});

test('reset revokes every object URL made by url() and returns the store to idle', async () => {
	const made = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:example-capture');
	const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
	const { bridge } = evidenceBridge();
	const store = createEntityEvidenceStore();
	store.show(bridge, target(ids.page));
	await settled(store);
	const file = mediaFile(store.result!.evidence.after.captures[0].capture);
	const url = await store.url('after', file);
	expect(url).toBe('blob:example-capture');
	expect(made).toHaveBeenCalledTimes(1);
	store.reset();
	expect(revoked).toHaveBeenCalledWith(url);
	const after = snapshot(store);
	expect(after).toEqual({ status: 'idle', result: null, error: '', read: undefined, refusals: {} });
	recordCases('createEntityEvidenceStore', 'reset-revokes-object-urls', [
		{ name: 'object URL made for the shown capture', input: { file }, output: url },
		{ name: 'revoked by reset', input: {}, output: revoked.mock.calls.length },
		{ name: 'state after reset', input: {}, output: after }
	]);
});

test('show reads again only for a changed target or bridge, and resets first', async () => {
	const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:example-capture');
	const { bridge, calls } = evidenceBridge();
	const store = createEntityEvidenceStore();
	store.show(bridge, target(ids.page));
	await settled(store);
	const file = mediaFile(store.result!.evidence.after.captures[0].capture);
	const url = await store.url('after', file);
	const readsBefore = calls.length;
	store.show(bridge, target(ids.page));
	expect(calls.length).toBe(readsBefore);
	expect(revoked).not.toHaveBeenCalled();
	store.show(bridge, target(ids.page, commits.middle));
	expect(revoked).toHaveBeenCalledWith(url);
	expect(store.result).toBeNull();
	await settled(store);
	const readsAfterTarget = calls.length;
	const other = evidenceBridge();
	store.show(other.bridge, target(ids.page, commits.middle));
	expect(store.status).toBe('loading');
	await settled(store);
	expect(other.calls.filter((call) => call.op === 'evidence')).toHaveLength(1);
	recordCases('createEntityEvidenceStore', 'show-resets-on-changed-target-or-bridge', [
		{
			name: 'reads when the same target is shown again',
			input: {},
			output: calls.length - readsBefore
		},
		{ name: 'reads after the target changes', input: {}, output: readsAfterTarget - readsBefore },
		{ name: 'reads after the bridge changes', input: {}, output: other.calls.length },
		{ name: 'URL revoked on target change', input: {}, output: revoked.mock.calls.length }
	]);
});
