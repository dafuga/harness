import { afterEach, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { CommentOutboxService } from '../../src/services/projects-sessions/CommentOutboxService';
import type { HumanCommentDraft } from '../../src/models/projects-sessions/ProjectContext.types';

const temporaryDirectories = new Set<string>();

afterEach(() => {
	for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
	temporaryDirectories.clear();
});

function temporaryOutbox() {
	const directory = mkdtempSync(join(tmpdir(), 'harness-comment-outbox-'));
	temporaryDirectories.add(directory);
	return new CommentOutboxService(join(directory, 'comments.json'));
}

function comment(projectId: string, requestId: string, text: string): HumanCommentDraft {
	return {
		projectId,
		requestId,
		anchor: {
			branch: 'main',
			commit: 'a'.repeat(40),
			entityId: 'page.home',
			version: null,
			imageSha256: null,
			state: null,
			viewport: null,
			region: null
		},
		text
	};
}

type SavedComment = Awaited<ReturnType<CommentOutboxService['save']>>;

function summary(saved: SavedComment) {
	return {
		kind: saved.kind,
		projectId: saved.projectId,
		draftId: saved.draftId,
		savedAt: saved.savedAt,
		requestId: saved.input.requestId,
		text: saved.input.text,
		reason: saved.reason
	};
}

test('save stores a human draft and reuses it when the same request is retried', async () => {
	const outbox = temporaryOutbox();
	const input = comment(
		'project-docs',
		'10000000-0000-4000-8000-000000000001',
		'Clarify the documented setup steps.'
	);
	const first = await outbox.save(input);
	const retry = await outbox.save(input);

	expect(first.kind).toBe('pending');
	expect(retry.draftId).toBe(first.draftId);
	expect(retry.input).toEqual(input);
	recordExampleCases(
		{
			unitId: 'desktop.service.comment-outbox',
			symbol: 'save',
			state: 'save-identical-retry',
			evidence: 'examples-cases',
			file: 'save-identical-retry.json'
		},
		[
			{ name: 'save a human comment', input, output: summary(first) },
			{ name: 'retry the same request', input, output: summary(retry) }
		]
	);
});

test('list returns pending drafts only for the requested project', async () => {
	const outbox = temporaryOutbox();
	const firstProject = 'project-docs';
	const secondProject = 'project-design';
	const firstInput = comment(
		firstProject,
		'10000000-0000-4000-8000-000000000002',
		'Clarify the documented setup steps.'
	);
	const secondInput = comment(
		secondProject,
		'10000000-0000-4000-8000-000000000003',
		'Add a note about the design review.'
	);
	await outbox.save(firstInput);
	await outbox.save(secondInput);
	const firstProjectDrafts = await outbox.list(firstProject);
	const secondProjectDrafts = await outbox.list(secondProject);

	expect(firstProjectDrafts.map((draft) => draft.projectId)).toEqual([firstProject]);
	expect(secondProjectDrafts.map((draft) => draft.projectId)).toEqual([secondProject]);
	recordExampleCases(
		{
			unitId: 'desktop.service.comment-outbox',
			symbol: 'list',
			state: 'list-by-project',
			evidence: 'examples-cases',
			file: 'list-by-project.json'
		},
		[
			{
				name: 'list comments for the documentation project',
				input: firstProject,
				output: firstProjectDrafts.map(summary)
			},
			{
				name: 'list comments for the design project',
				input: secondProject,
				output: secondProjectDrafts.map(summary)
			}
		]
	);
});
