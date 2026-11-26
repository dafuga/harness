import { test } from 'vitest';
import type { CommittedThread } from '../../../collaboration/src/models/planning-collaboration/Collaboration.types';
import {
	threadInfo,
	pendingEntries,
	requestEntry
} from '../../src/components/explorer-ui/thread-panel/commentEntries';
import type { DesignVersion } from '../../src/models/planning-collaboration/DesignVersion.types';
import type { HumanCommentResult } from '../../src/models/projects-sessions/ProjectContext.types';
import type { ThreadInfo } from '../../src/models/development-tooling/Desktop.types';
import type { RunDraft } from '../../src/utils/explorer-ui/composeModes.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { thread } from './desktop.function.comment-entries.cases';

const region = { x: 0.12, y: 0.4, width: 0.5, height: 0.3 };
const version = 'v003';
const imageSha256 = '3f9a1c7e5b2d8046a1e9c3f7b5d2e8a04c6f1b9e7d3a5c8f2e4b6d1a9c7e3f05';

test('Summarizes a saved thread with its supplied pin', () => {
	const anchoredThread: CommittedThread = {
		...thread,
		id: 'f3c0a6d9-2e8b-4d17-b4c5-7a9e1f6d3b02',
		anchor: {
			...thread.anchor,
			entityId: 'reports.component.evidence-grid',
			version,
			imageSha256,
			state: 'default',
			viewport: 'desktop',
			region
		},
		comments: [thread.comments[0]]
	};
	const output = threadInfo(anchoredThread, 2);

	expect(output).toEqual({
		id: anchoredThread.id,
		pin: 2,
		version,
		imageSha256,
		state: 'default',
		viewport: 'desktop',
		region,
		messageCount: 1
	});
	recordExampleCases(
		{
			unitId: 'desktop.function.comment-entries',
			symbol: 'threadInfo',
			state: 'summarizes-a-saved-thread-with-its-supplied-pin',
			evidence: 'examples-cases',
			file: 'summarizes-a-saved-thread-with-its-supplied-pin.json'
		},
		[
			{
				name: 'summarize the saved tablet-review thread as pin two',
				input: { thread: anchoredThread, pin: 2 },
				output
			}
		]
	);
});

test('Shows only matching local drafts with thread context', () => {
	const matchingDraft: HumanCommentResult = {
		kind: 'pending',
		projectId: '0f6a3c8e-d2b4-4e91-b7a5-5c1f9e8d2a64',
		draftId: 'e7a1c5d3-94f0-4b2e-8c6d-1a3f7b9e0d58',
		savedAt: '2026-11-15T08:03:55.402Z',
		input: {
			projectId: '0f6a3c8e-d2b4-4e91-b7a5-5c1f9e8d2a64',
			requestId: '1d7c4e90-b2a6-4f38-8e05-a6d3c9f1b27e',
			threadId: thread.id,
			anchor: thread.anchor,
			text: 'Should the pending note say which thread this reply belongs to?'
		},
		reason: 'Saved locally; not synced. Connect a verified shared project to publish.'
	};
	const otherEntityDraft: HumanCommentResult = {
		...matchingDraft,
		draftId: 'f0a6d2b8-5c31-4e97-9b4a-2d8f6e1c0a73',
		input: {
			...matchingDraft.input,
			anchor: { ...thread.anchor, entityId: 'reports.component.evidence-grid' }
		}
	};
	const sharedResult: HumanCommentResult = {
		kind: 'shared',
		projectId: matchingDraft.projectId,
		thread
	};
	const threads: ThreadInfo[] = [
		{
			id: thread.id,
			pin: 1,
			version: null,
			imageSha256: null,
			state: null,
			viewport: null,
			region: null,
			messageCount: 2
		}
	];
	const results = [matchingDraft, otherEntityDraft, sharedResult];
	const output = pendingEntries(results, 'desktop.function.comment-entries', threads);

	expect(output).toHaveLength(1);
	expect(output[0]).toMatchObject({
		id: matchingDraft.draftId,
		pending: true,
		note: 'Pending on this device · not shared · Thread #1'
	});
	recordExampleCases(
		{
			unitId: 'desktop.function.comment-entries',
			symbol: 'pendingEntries',
			state: 'shows-only-matching-local-drafts-with-thread-context',
			evidence: 'examples-cases',
			file: 'shows-only-matching-local-drafts-with-thread-context.json'
		},
		[
			{
				name: 'include matching pending draft and skip other entity and shared results',
				input: { results, entityId: 'desktop.function.comment-entries', threads },
				output
			}
		]
	);
});

test('Builds a temporary entry for each submitted request mode', () => {
	const runId = 'a2c8e41f-5d7b-4a06-9f3e-b8d2c7e1f094';
	const changeRequest: RunDraft = {
		provider: 'claude',
		model: 'claude-opus-5-5',
		effort: 'xhigh',
		text: 'Keep the thread number in the pending note when the thread is listed.',
		mode: 'change'
	};
	const askRequest: RunDraft = {
		provider: 'claude',
		model: 'claude-opus-5-5',
		effort: 'medium',
		text: 'Why is the thread number missing from the note on this draft?',
		mode: 'ask'
	};
	const design: DesignVersion = {
		version,
		createdAt: '2026-11-14T16:30:08.214Z',
		commit: 'e04b7c19a3f6d2805c1e9b4a7d3f0e6c8b2a5d19',
		generator: 'claude · claude-opus-5-5',
		prompt: 'Describe how comment entries are built for the thread panel.',
		baseRevision: 'c7f2a0d4e9b13856f0a2c8e7d4b9f1a6e3d0c582',
		images: [{ state: 'default', viewport: 'desktop', sha256: imageSha256, bytes: 1200 }],
		approval: null
	};
	const changeEntry = requestEntry(runId, changeRequest, design);
	const askEntry = requestEntry('5c9f1e27-08ab-4d3e-a6f4-e2b7c0d19a58', askRequest, undefined);
	const summary = ({
		id,
		at,
		text,
		mode,
		provider,
		model,
		version: entryVersion,
		imageSha256: hash
	}: typeof changeEntry) => ({
		id,
		at,
		text,
		mode,
		provider,
		model,
		version: entryVersion,
		imageSha256: hash
	});

	expect(changeEntry).toMatchObject({ id: runId, mode: 'change', version, imageSha256 });
	expect(askEntry).toMatchObject({ mode: null, version: null, imageSha256: null });
	expect(askEntry.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	recordExampleCases(
		{
			unitId: 'desktop.function.comment-entries',
			symbol: 'requestEntry',
			state: 'builds-a-temporary-entry-for-each-submitted-request-mode',
			evidence: 'examples-cases',
			file: 'builds-a-temporary-entry-for-each-submitted-request-mode.json'
		},
		[
			{
				name: 'show a submitted change request with the selected design image',
				input: { runId, request: changeRequest, design },
				output: summary(changeEntry)
			},
			{
				name: 'show an ask request without a design',
				input: { runId: askEntry.id, request: askRequest },
				output: summary(askEntry)
			}
		]
	);
});
