import { DatabaseSync } from 'node:sqlite';
import { expect, onTestFinished, test, vi } from 'vitest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';

const now = () => 1795815000000;
const itemId = 'drafttask1';
const id = '77ecc6dd-7d69-4c9c-9981-2804ecc6f93c';
const fleetPath = '/sync/outgoing-drafts';
const ownerPath = '/sync/owner/outgoing-drafts';

const draft = {
	id,
	itemId,
	message: {
		channel: 'gmail',
		account: 'fixture',
		to: ['recipient@example.test'],
		cc: [],
		body: 'Private fixture text'
	}
};

function fixture() {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const fleet = new TrackerSyncAuthService('synthetic-fleet-key');
	const owner = new TrackerSyncAuthService('synthetic-owner-key');
	const send = vi.fn(async () => ({
		kind: 'sent' as const,
		receipt: { reference: 'fixture-delivery' }
	}));
	const runtime = new TrackerNativeRuntimeService(database, {
		node: 'hub',
		role: 'hub',
		now,
		syncResponder: { auth: fleet, outgoingOwnerAuth: owner },
		outgoingProvider: () => send
	});
	runtime.store.appendLocal({ itemId, fields: { title: 'Fixture draft task' } });
	const call = (pathAndQuery: string, input?: object, key?: TrackerSyncAuthService) => {
		const body = input === undefined ? undefined : JSON.stringify(input);
		const method = body === undefined ? 'GET' : 'POST';
		const signature = { method, pathAndQuery, body };
		const headers = new Headers({
			'x-tracker-node': 'agent-host',
			'x-tracker-as': 'Daniel',
			...(key && { authorization: key.authorizationHeader(signature, now()) })
		});
		return runtime.sync!.handle({
			...signature,
			body: new Request('https://fixture.test', { method, body }).body,
			headers
		});
	};
	return { fleet, owner, call, send };
}

test('fleet creation returns a redacted receipt and only the owner grant can authorize delivery', async () => {
	const { call, fleet, owner, send } = fixture();

	const created = await call(fleetPath, draft, fleet);
	expect(created.status).toBe(201);
	expect(await created.json()).toEqual({
		id,
		itemId,
		channel: 'gmail',
		status: 'draft',
		delivery: 'idle',
		revision: 1
	});
	expect(await call(ownerPath, undefined, fleet)).toMatchObject({ status: 403 });
	expect(await call(ownerPath)).toMatchObject({ status: 403 });
	const listed = await call(ownerPath, undefined, owner);
	expect(listed.headers.get('cache-control')).toBe('private, no-store');
	expect(await listed.json()).toEqual([
		{
			...draft,
			canSend: true,
			by: 'agent-host',
			at: now(),
			revision: 1,
			conversationId: 'cos',
			receipt: null,
			status: 'draft',
			delivery: 'idle',
			updatedBy: 'agent-host',
			updatedAt: now()
		}
	]);
	const action = { id, revision: 1, action: 'send' };
	expect(await call(ownerPath, action, fleet)).toMatchObject({ status: 403 });
	expect(await call(fleetPath, action, owner)).toMatchObject({ status: 401 });
	expect(await call(ownerPath, { ...action, by: 'Daniel' }, owner)).toMatchObject({ status: 400 });
	expect(send).not.toHaveBeenCalled();
	const sent = await call(ownerPath, action, owner);
	expect(sent.status).toBe(200);
	expect(await sent.json()).toMatchObject({
		status: 'sent',
		updatedBy: 'Daniel',
		receipt: { reference: 'fixture-delivery' }
	});
	expect(await call(ownerPath, action, owner)).toMatchObject({ status: 409 });
	expect(send).toHaveBeenCalledTimes(1);
});
