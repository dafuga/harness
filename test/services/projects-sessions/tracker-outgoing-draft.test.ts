import { DatabaseSync } from 'node:sqlite';
import { expect, onTestFinished, test, vi } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerOutgoingDraftService } from '../../../src/services/projects-sessions/TrackerOutgoingDraftService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';

const submitted = {
	id: '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c',
	itemId: 'item123456',
	message: {
		channel: 'gmail',
		account: 'fixture',
		to: ['receiver@example.test'],
		cc: [],
		body: 'Original body'
	}
};
const creator = { kind: 'agent' as const, by: 'fixture-host' };
const owner = { kind: 'owner' as const, by: 'Daniel' };
const displayed = { id: submitted.id, revision: 1 };

function fixture() {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const store = new TrackerPersistenceService(database, 'hub');
	store.appendLocal({ itemId: submitted.itemId, fields: { title: 'Fixture' } });
	const send = vi.fn(async () => ({ kind: 'sent' as const, receipt: { reference: 'delivery-1' } }));
	const service = new TrackerOutgoingDraftService(store, {
		provider: (message) => (message.account === 'fixture' ? send : undefined)
	});
	const items = new TrackerItemReadRepository(database);
	return {
		service,
		send,
		notes: () => items.getStored(submitted.itemId).notes_log.map(({ text }) => text)
	};
}

test('accepts an idempotent draft from an agent and reserves send approval for the owner', async () => {
	const { service, send } = fixture();
	const draft = service.create(submitted, creator);
	expect(service.create(submitted, creator)).toEqual(draft);
	expect(service.list(owner)).toEqual([draft]);
	expect(service.list({ ...creator, by: 'other' })).toEqual([]);
	expect(() => service.create({ ...submitted, by: 'Daniel' }, creator)).toThrow('invalid draft');
	await expect(service.send(displayed, creator)).rejects.toThrow('owner approval required');
	expect(() => service.discard(displayed, creator)).toThrow('owner approval required');
	expect(send).not.toHaveBeenCalled();
});

test('delivers the reviewed revision once and records the outcome without the message', async () => {
	const { service, send, notes } = fixture();
	service.create(submitted, creator);
	service.edit(displayed, { to: ['new@example.test'], cc: [], body: 'Reviewed body' }, owner);
	await expect(service.send(displayed, owner)).rejects.toThrow('draft changed');
	const revision = { ...displayed, revision: 2 };
	const results = await Promise.allSettled([
		service.send(revision, owner),
		service.send(revision, owner)
	]);
	expect(results.map(({ status }) => status)).toEqual(['fulfilled', 'rejected']);
	expect(send).toHaveBeenCalledTimes(1);
	expect(send.mock.calls[0]).toEqual([
		expect.objectContaining({ body: 'Reviewed body', to: ['new@example.test'] }),
		expect.any(String)
	]);
	expect(service.list(owner)).toMatchObject([
		{ status: 'sent', receipt: { reference: 'delivery-1' } }
	]);
	expect(notes()).toContain(`Outgoing draft ${submitted.id} edited (revision 2)`);
	expect(notes()).toContain(`Outgoing draft ${submitted.id} approved (revision 2)`);
	expect(notes()).toContain(`Outgoing draft ${submitted.id} sent (revision 2, receipt delivery-1)`);
	expect(notes().join('\n')).not.toContain('Reviewed body');
	expect(notes().join('\n')).not.toContain('new@example.test');
});

test('keeps a draft unavailable for sending when the account is unsupported or delivery is unconfirmed', async () => {
	const { service, send, notes } = fixture();
	const withoutProvider = {
		...submitted,
		message: { ...submitted.message, account: 'unavailable' }
	};
	service.create(withoutProvider, creator);
	await expect(service.send(displayed, owner)).rejects.toThrow('sending account unavailable');
	expect(service.discard(displayed, owner).status).toBe('discarded');
	expect(notes().join('\n')).toContain('discarded');
	const next = { ...submitted, id: '4ee88a6a-bb36-4dfc-b48c-e256e52ec359' };
	service.create(next, creator);
	send.mockRejectedValueOnce(new Error('provider response was lost'));
	const displayedNext = { ...displayed, id: next.id };
	await expect(service.send(displayedNext, owner)).resolves.toMatchObject({
		delivery: 'unconfirmed'
	});
	await expect(service.send(displayedNext, owner)).rejects.toThrow('draft changed');
	expect(send).toHaveBeenCalledTimes(1);
});
