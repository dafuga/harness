import { afterEach, beforeEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';
import { recordedPreview } from '../../src/components/recorded-preview/recordedPreview';
import { commits, data, evidenceBridge, ids, scopeOf } from '../evidence-fixture';

const scope = scopeOf(ids.page);
const answer = data.results[`${ids.page}|current|${commits.tip}`];
const capture = answer.evidence.after.captures.find(
	(item) => item.capture.kind === 'screenshot' && item.usable
)!;
const preview = {
	source: 'recorded' as const,
	scenario: capture.scenario,
	state: capture.state,
	viewport: capture.capture.viewport!
};
const workspaceOf = (bridge: object) =>
	({
		bridge,
		snapshot: { revision: { branch: scope.branch, commit: scope.commit } },
		context: { projectId: scope.projectId },
		pinned: false
	}) as unknown as Workspace;

beforeEach(() => {
	vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:capture'), revokeObjectURL: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

test('a runtime thumbnail reads the precisely bound capture at pinned revisions', async () => {
	const { bridge, calls } = evidenceBridge();
	const shown: Array<{ status: string; url: string; caption: string }> = [];
	const release = recordedPreview(workspaceOf(bridge), ids.page, preview, (value) =>
		shown.push(value)
	);
	await expect.poll(() => shown.at(-1)?.status).toBe('ready');
	expect(shown.at(-1)?.url).toBe('blob:capture');
	expect(shown.at(-1)?.caption).toContain('Screenshot');
	expect(calls).toHaveLength(2);
	expect(calls[1]).toMatchObject({
		op: 'artifact',
		projectId: scope.projectId,
		entityId: ids.page,
		commit: scope.commit,
		scenarioId: preview.scenario,
		state: preview.state,
		viewport: preview.viewport,
		sha256: capture.capture.sha256,
		notesRevision: answer.identity.notesRevision,
		evidenceRevision: answer.identity.evidenceRevision
	});
	release();
	expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:capture');
});

test('a different state is unavailable instead of borrowing another screenshot', async () => {
	const { bridge, calls } = evidenceBridge();
	const shown: Array<{ status: string }> = [];
	recordedPreview(workspaceOf(bridge), ids.page, { ...preview, state: 'never-captured' }, (value) =>
		shown.push(value)
	);
	await expect.poll(() => shown.at(-1)?.status).toBe('missing');
	expect(calls.map((call) => call.op)).toEqual(['evidence']);
	expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('identical screenshot bytes in two states keep the exact selected state', async () => {
	const { bridge, calls } = evidenceBridge();
	const duplicate = structuredClone(answer);
	duplicate.evidence.after.captures.unshift({ ...capture, state: 'another-state' });
	bridge.evidence = async () => duplicate;
	const shown: Array<{ status: string }> = [];
	recordedPreview(workspaceOf(bridge), ids.page, preview, (value) => shown.push(value));
	await expect.poll(() => shown.at(-1)?.status).toBe('ready');
	expect(calls.at(-1)).toMatchObject({ op: 'artifact', state: preview.state });
});

test('an older page can use a state that explicitly names it in the recorded contract', async () => {
	const { bridge } = evidenceBridge();
	const older = structuredClone(answer);
	const scenario = older.evidence.after.detail!.registry.scenarios.find(
		(item) => item.id === preview.scenario
	)!;
	// Metadata port fixture: this page is explicitly named by just the intended recorded state.
	for (const state of scenario.states)
		state.units = state.id === preview.state ? [ids.page] : undefined;
	bridge.evidence = async () => older;
	const shown: Array<{ status: string; caption: string }> = [];
	recordedPreview(workspaceOf(bridge), ids.page, { source: 'recorded' }, (value) =>
		shown.push(value)
	);
	await expect.poll(() => shown.at(-1)?.status).toBe('ready');
	expect(shown.at(-1)?.caption).toContain(preview.state.replaceAll('-', ' '));
});

test('a response for another project is refused before reading any artifact', async () => {
	const { bridge, calls } = evidenceBridge();
	bridge.evidence = async () => ({
		...answer,
		identity: { ...answer.identity, projectId: 'other' }
	});
	const shown: Array<{ status: string; reason: string }> = [];
	recordedPreview(workspaceOf(bridge), ids.page, preview, (value) => shown.push(value));
	await expect.poll(() => shown.at(-1)?.status).toBe('error');
	expect(shown.at(-1)?.reason).toContain('another project');
	expect(calls).toEqual([]);
	expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('damaged image bytes are rejected before an object URL exists', async () => {
	const { bridge } = evidenceBridge({ corrupt: [capture.capture.sha256] });
	const shown: Array<{ status: string; reason: string }> = [];
	recordedPreview(workspaceOf(bridge), ids.page, preview, (value) => shown.push(value));
	await expect.poll(() => shown.at(-1)?.status).toBe('error');
	expect(shown.at(-1)?.reason).toContain('SHA-256');
	expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('a response arriving after project navigation cannot paint the previous project image', async () => {
	const { bridge } = evidenceBridge();
	let deliver = (_value: typeof answer) => {};
	bridge.evidence = () => new Promise((done) => (deliver = done));
	const shown: Array<{ status: string }> = [];
	const release = recordedPreview(workspaceOf(bridge), ids.page, preview, (value) =>
		shown.push(value)
	);
	release();
	deliver(answer);
	await new Promise((done) => setTimeout(done, 5));
	expect(shown.map((value) => value.status)).toEqual(['loading']);
	expect(URL.createObjectURL).not.toHaveBeenCalled();
});
