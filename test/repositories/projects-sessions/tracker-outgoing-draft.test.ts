import { DatabaseSync } from 'node:sqlite';
import { expect, onTestFinished, test } from 'vitest';
import { TrackerOutgoingDraftRepository } from '../../../src/repositories/projects-sessions/TrackerOutgoingDraftRepository';
import type { NewTrackerOutgoingDraft } from '../../../src/repositories/projects-sessions/TrackerOutgoingDraftRepository.types';

const draft: NewTrackerOutgoingDraft = {
	id: 'draft-1',
	itemId: 'item-1',
	conversationId: 'cos',
	by: 'agent-1',
	at: 1000,
	message: {
		channel: 'gmail',
		account: 'test-sender',
		to: ['reply@example.test'],
		cc: [],
		subject: 'Re: Fixture',
		thread: { id: 'gmail-thread-1', label: 'Original email' },
		body: 'First version'
	}
};
const approval = { id: draft.id, revision: 2, by: 'Daniel', at: 2000 };

function fixture() {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const repo = new TrackerOutgoingDraftRepository(database);
	repo.initialize();
	return { repo, reopen: () => new TrackerOutgoingDraftRepository(database) };
}

test('stores the creating actor, selected sender and conversation with the draft', () => {
	const { repo, reopen } = fixture();
	const created = repo.create(draft);
	expect(created).toMatchObject({
		...draft,
		status: 'draft',
		delivery: 'idle',
		revision: 1
	});
	expect(reopen().find(draft.id)).toEqual(created);
	expect(repo.list('cos')).toEqual([created]);
	expect(repo.list('different-conversation')).toEqual([]);
});

test('reserves only the displayed revision and keeps the receipt after competing commands', () => {
	const { repo, reopen } = fixture();
	repo.create(draft);
	const edited = { ...draft.message, body: 'Approved version' };
	expect(repo.edit({ ...approval, revision: 1 }, edited)?.revision).toBe(2);
	expect(repo.reserve({ ...approval, revision: 1 }, 'stale')).toBeUndefined();
	expect(repo.reserve(approval, 'attempt-a')).toMatchObject({
		delivery: 'sending',
		message: edited
	});
	expect(reopen().reserve(approval, 'attempt-b')).toBeUndefined();
	expect(repo.discard(approval)).toBeUndefined();
	expect(repo.edit(approval, draft.message)).toBeUndefined();
	const receipt = { reference: 'sent-1', url: 'https://example.test/thread' };
	expect(
		repo.finish({ ...approval, attempt: 'attempt-b' }, { kind: 'sent', receipt })
	).toBeUndefined();
	const sent = reopen().finish({ ...approval, attempt: 'attempt-a' }, { kind: 'sent', receipt });
	expect(sent).toMatchObject({ status: 'sent', delivery: 'idle', receipt, updatedBy: 'Daniel' });
	expect(repo.reserve(approval, 'attempt-c')).toBeUndefined();
	expect(repo.find(draft.id)).toEqual(sent);
});

test('keeps a discarded draft in its conversation and prevents it from being sent', () => {
	const { repo } = fixture();
	repo.create(draft);
	const version = { ...approval, revision: 1 };
	expect(repo.discard(version)).toMatchObject({ status: 'discarded', updatedBy: 'Daniel' });
	expect(repo.reserve(version, 'attempt')).toBeUndefined();
	expect(repo.list('cos')).toMatchObject([{ id: draft.id, status: 'discarded' }]);
});

test('blocks uncertain delivery and admits a new attempt after confirmed non-delivery', () => {
	const { repo, reopen } = fixture();
	repo.create(draft);
	const version = { ...approval, revision: 1 };
	repo.reserve(version, 'attempt-a');
	const first = { ...version, attempt: 'attempt-a' };
	expect(repo.finish(first, { kind: 'unconfirmed' })?.delivery).toBe('unconfirmed');
	expect(reopen().reserve(version, 'attempt-b')).toBeUndefined();
	expect(repo.discard(version)).toBeUndefined();
	expect(repo.finish(first, { kind: 'failed' })).toMatchObject({ delivery: 'failed', revision: 2 });
	expect(repo.reserve(version, 'replayed-tap')).toBeUndefined();
	expect(repo.reserve({ ...version, revision: 2 }, 'attempt-b')?.delivery).toBe('sending');
	expect(repo.finish(first, { kind: 'unconfirmed' })).toBeUndefined();
});
