import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { expect, test } from 'vitest';
import WebSocket from 'ws';
import { VaultCdpRelayAdapter } from '../../../src/adapters/accounts-access/VaultCdpRelayAdapter';
import {
	approval,
	sessionRequest,
	sessionUid,
	sign,
	vaultBroker
} from '../../support/credential-vault/broker';

function relayFixture() {
	const fixture = vaultBroker();
	const input = sessionRequest(fixture.seal.runnerKey());
	const created = fixture.broker.create(input, sessionUid);
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	fixture.broker.decide(sign(fixture, input, approval(input, created, fixture)));
	fixture.broker.claim(ticket, sessionUid);
	const { lease } = fixture.keeper.issue(ticket, sessionUid, {
		logout: '/logout',
		revoke: null,
		securityLog: '/audit'
	});
	const attachment = fixture.keeper.attach(lease, input.session, sessionUid);
	const toBrowser = new PassThrough();
	const fromBrowser = new PassThrough();
	const peer = { uid: sessionUid };
	const adapter = new VaultCdpRelayAdapter({
		keeper: fixture.keeper,
		lease,
		peerUid: () => peer.uid,
		pipe: { writable: toBrowser, readable: fromBrowser }
	});
	return { ...fixture, input, lease, attachment, toBrowser, fromBrowser, peer, adapter };
}

async function refusal(endpoint: string, headers: Record<string, string>): Promise<number> {
	const client = new WebSocket(endpoint, { headers });
	const [, response] = await once(client, 'unexpected-response');
	response.resume();
	return response.statusCode;
}

async function connect(attachment: ReturnType<typeof relayFixture>['attachment']) {
	const client = new WebSocket(attachment.endpoint, { headers: attachment.headers });
	await once(client, 'open');
	return client;
}

test('listen exposes the lease Unix socket and admits one peer with the scoped token', async () => {
	const run = relayFixture();
	await run.adapter.listen();
	try {
		const { endpoint, headers } = run.attachment;
		expect(endpoint).toContain(join(run.state, 'run', run.lease, 'cdp.sock'));
		expect(endpoint).not.toContain(headers.Authorization);
		expect(await refusal(endpoint, { Authorization: 'Bearer copied' })).toBe(403);
		run.peer.uid = sessionUid + 1;
		expect(await refusal(endpoint, headers)).toBe(403);
		run.peer.uid = sessionUid;
		const client = await connect(run.attachment);
		expect(await refusal(endpoint, headers)).toBe(403);
		const written = once(run.toBrowser, 'data');
		client.send(JSON.stringify({ id: 23, method: 'Browser.getVersion' }));
		const [frame] = await written;
		const request = JSON.parse(frame.toString().slice(0, -1));
		expect(request).toMatchObject({ method: 'Browser.getVersion' });
		const received = once(client, 'message');
		run.fromBrowser.write('{"id":' + request.id + ',"result":');
		run.fromBrowser.write('{"product":"Synthetic Chromium"}}\0');
		const [message] = await received;
		expect(JSON.parse(message.toString())).toEqual({
			id: 23,
			result: { product: 'Synthetic Chromium' }
		});
	} finally {
		await run.adapter.close();
	}
});

test('a reconnect receives only its replies and remains bounded by the lease window', async () => {
	const run = relayFixture();
	await run.adapter.listen();
	try {
		const first = await connect(run.attachment);
		const sent = once(run.toBrowser, 'data');
		first.send('{"id":1,"method":"Browser.getVersion"}');
		const [oldFrame] = await sent;
		const closed = once(first, 'close');
		first.close();
		await closed;
		const second = await connect(run.attachment);
		const resent = once(run.toBrowser, 'data');
		second.send('{"id":1,"method":"Browser.getVersion"}');
		const [newFrame] = await resent;
		const oldId = JSON.parse(oldFrame.toString().slice(0, -1)).id;
		const newId = JSON.parse(newFrame.toString().slice(0, -1)).id;
		expect(newId).not.toBe(oldId);
		const reply = once(second, 'message');
		run.fromBrowser.write(JSON.stringify({ id: oldId, result: { old: true } }) + '\0');
		run.fromBrowser.write(JSON.stringify({ id: newId, result: { current: true } }) + '\0');
		expect(JSON.parse((await reply)[0].toString())).toEqual({ id: 1, result: { current: true } });
		const disconnected = once(second, 'close');
		second.close();
		await disconnected;
		run.clock.now += 30_000;
		expect(await refusal(run.attachment.endpoint, run.attachment.headers)).toBe(403);
	} finally {
		await run.adapter.close();
	}
});
