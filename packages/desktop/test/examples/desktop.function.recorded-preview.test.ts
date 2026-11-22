import { afterEach, beforeEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import { recordedPreview } from '../../src/components/shared-primitives/recorded-preview/recordedPreview';
import { commits, data, evidenceBridge, ids, scopeOf } from '../evidence-fixture';
import type { PreviewState } from '../../src/utils/shared-primitives/recordedPreview';

const scope = scopeOf(ids.page);
const answer = data.results[`${ids.page}|current|${commits.tip}`];
const capture = answer.evidence.after.captures.find(
	(item) => item.capture.kind === 'screenshot' && item.usable
)!;
const thumbnail = {
	source: 'recorded' as const,
	scenario: capture.scenario,
	state: capture.state,
	viewport: capture.capture.viewport!
};

/** A workspace shown at the tip of the fixture branch, with the given bridge. */
const workspaceOf = (bridge: object) =>
	({
		bridge,
		snapshot: { revision: { branch: scope.branch, commit: scope.commit } },
		context: { projectId: scope.projectId },
		pinned: false
	}) as unknown as Workspace;

/** Resolves once the view has reached the expected status, and returns every state it was given. */
async function settle(shown: PreviewState[], status: PreviewState['status']) {
	await expect.poll(() => shown.at(-1)?.status).toBe(status);
	return shown.map(({ status: value, reason, caption }) => ({ status: value, reason, caption }));
}

beforeEach(() => {
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recorded-preview-1');
	vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test('Shows loading first, then the recorded screenshot bound to the thumbnail', async () => {
	const { bridge, calls } = evidenceBridge();
	const shown: PreviewState[] = [];
	const release = recordedPreview(workspaceOf(bridge), ids.page, thumbnail, (value) =>
		shown.push(value)
	);
	const states = await settle(shown, 'ready');
	const artifact = calls.at(-1)!;

	expect(calls.map((call) => call.op)).toEqual(['evidence', 'artifact']);
	expect(states[0]).toEqual({ status: 'loading', reason: '', caption: '' });
	expect(states.at(-1)?.status).toBe('ready');
	expect(states.at(-1)?.reason).toBe('');
	expect(states.at(-1)?.caption).toContain('Screenshot');
	expect(shown.at(-1)?.url).toBe('blob:recorded-preview-1');
	expect(artifact).toMatchObject({
		scenarioId: thumbnail.scenario,
		state: thumbnail.state,
		viewport: thumbnail.viewport,
		sha256: capture.capture.sha256
	});
	release();

	recordExampleCases(
		{
			unitId: 'desktop.function.recorded-preview',
			symbol: 'recordedPreview',
			state: 'shows-loading-then-the-recorded-screenshot-when-bound',
			evidence: 'examples-cases',
			file: 'shows-loading-then-the-recorded-screenshot-when-bound.json'
		},
		[
			{
				name: 'bound thumbnail on the branch tip',
				input: { entityId: ids.page, thumbnail, commit: scope.commit },
				output: { states, artifactState: artifact.state, artifactSha256: artifact.sha256 }
			}
		]
	);
});

test('Reports missing when the connection has no evidence reader', async () => {
	const shown: PreviewState[] = [];
	const release = recordedPreview(workspaceOf({}), ids.page, thumbnail, (value) =>
		shown.push(value)
	);
	const states = await settle(shown, 'missing');
	release();

	expect(states.at(-1)).toEqual({
		status: 'missing',
		reason: 'Recorded screenshots cannot be read on this connection.',
		caption: ''
	});
	expect(URL.createObjectURL).not.toHaveBeenCalled();

	recordExampleCases(
		{
			unitId: 'desktop.function.recorded-preview',
			symbol: 'recordedPreview',
			state: 'reports-missing-when-the-connection-has-no-evidence-reader',
			evidence: 'examples-cases',
			file: 'reports-missing-when-the-connection-has-no-evidence-reader.json'
		},
		[
			{
				name: 'workspace whose bridge has no evidence reader',
				input: { entityId: ids.page, thumbnail, bridgeHasEvidence: false },
				output: { states, objectUrlsCreated: 0 }
			}
		]
	);
});

test('Refuses an answer that names another project before reading any artifact', async () => {
	const { bridge, calls } = evidenceBridge();
	bridge.evidence = async () => ({
		...answer,
		identity: { ...answer.identity, projectId: 'other' }
	});
	const shown: PreviewState[] = [];
	const release = recordedPreview(workspaceOf(bridge), ids.page, thumbnail, (value) =>
		shown.push(value)
	);
	const states = await settle(shown, 'error');
	release();

	expect(states.at(-1)?.reason).toBe('The screenshot answer belongs to another project.');
	expect(calls).toEqual([]);
	expect(URL.createObjectURL).not.toHaveBeenCalled();

	recordExampleCases(
		{
			unitId: 'desktop.function.recorded-preview',
			symbol: 'recordedPreview',
			state: 'refuses-an-answer-for-another-project',
			evidence: 'examples-cases',
			file: 'refuses-an-answer-for-another-project.json'
		},
		[
			{
				name: 'answer whose identity names project other',
				input: { requestedProjectId: scope.projectId, answerProjectId: 'other' },
				error: { name: 'RecordedPreviewError', message: states.at(-1)!.reason }
			}
		]
	);
});

test('Refuses an answer that names another entity or commit', async () => {
	const { bridge, calls } = evidenceBridge();
	bridge.evidence = async () => ({
		...answer,
		scope: { ...answer.scope, location: { ...answer.scope.location, entity: 'other.entity' } }
	});
	const shown: PreviewState[] = [];
	const release = recordedPreview(workspaceOf(bridge), ids.page, thumbnail, (value) =>
		shown.push(value)
	);
	const states = await settle(shown, 'error');
	release();

	expect(states.at(-1)?.reason).toBe('The screenshot answer belongs to another entity or commit.');
	expect(calls).toEqual([]);
	expect(URL.createObjectURL).not.toHaveBeenCalled();

	recordExampleCases(
		{
			unitId: 'desktop.function.recorded-preview',
			symbol: 'recordedPreview',
			state: 'refuses-an-answer-for-another-entity-or-commit',
			evidence: 'examples-cases',
			file: 'refuses-an-answer-for-another-entity-or-commit.json'
		},
		[
			{
				name: 'answer whose scope names another entity',
				input: { requestedEntityId: ids.page, answerEntityId: 'other.entity' },
				error: { name: 'RecordedPreviewError', message: states.at(-1)!.reason }
			}
		]
	);
});

test('Stop revokes the object URL it created and suppresses later updates', async () => {
	const { bridge } = evidenceBridge();
	const shown: PreviewState[] = [];
	const release = recordedPreview(workspaceOf(bridge), ids.page, thumbnail, (value) =>
		shown.push(value)
	);
	await settle(shown, 'ready');
	const before = shown.length;
	release();

	expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recorded-preview-1');
	expect(shown).toHaveLength(before);

	recordExampleCases(
		{
			unitId: 'desktop.function.recorded-preview',
			symbol: 'recordedPreview',
			state: 'releases-the-object-url-on-stop',
			evidence: 'examples-cases',
			file: 'releases-the-object-url-on-stop.json'
		},
		[
			{
				name: 'stop after the screenshot is ready',
				input: { releasedAfter: 'ready' },
				output: {
					revoked: vi.mocked(URL.revokeObjectURL).mock.calls.map(([url]) => url),
					statuses: shown.map((value) => value.status)
				}
			}
		]
	);
});
