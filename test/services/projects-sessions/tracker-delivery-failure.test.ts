import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { trackerNodeNotifications } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeNotifications';
import type { TrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { clock, fixtureItem, notificationFixture, start } from './tracker-notification/fixture';

async function fakeEndpoint(run: (origin: string, hits: string[]) => Promise<void>) {
	const hits: string[] = [];
	const server = createServer((request, response) => {
		hits.push(request.url!);
		request.resume();
		if (request.url === '/reset') request.socket.destroy();
		else response.writeHead(request.url === '/broken' ? 500 : 204).end();
	});
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	try {
		await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits);
	} finally {
		server.closeAllConnections();
		await new Promise((done) => server.close(done));
	}
}

function nodeFixture(origin: string, failing: string) {
	const composed = trackerNodeNotifications({
		role: 'hub',
		node: 'fixture-node',
		notifications: {
			targets: { bad: { url: `${origin}/${failing}` }, good: { url: `${origin}/good` } }
		}
	} as unknown as TrackerNodeConfig)!;
	const logs: string[] = [];
	const f = notificationFixture({
		options: {
			webhook: undefined,
			destinations: composed.destinations,
			log: (message) => logs.push(message)
		}
	});
	for (const id of ['bad', 'good'])
		f.rows.set(
			id,
			fixtureItem(id, {
				status: 'done',
				callback: { kind: 'http', id, node: 'fixture-node' },
				clocks: { status: clock() }
			})
		);
	return { ...f, logs };
}

for (const [failing, diagnostic] of [
	['broken', 'HTTP 500'],
	['reset', 'UND_ERR_SOCKET']
])
	test(`a ${failing} endpoint backs off, gives up and never stalls other targets`, () =>
		fakeEndpoint(async (origin, hits) => {
			const f = nodeFixture(origin, failing);
			const row = () => [...f.queue.read().callbacks.values()].find((r) => r.itemId === 'bad')!;

			await f.service.tick();
			expect(hits).toEqual([`/${failing}`, '/good']);
			expect(f.queue.read().inFlight).toBeUndefined();
			expect(row()).toMatchObject({ status: 'pending', attempts: 1, nextAt: start + 30_000 });
			expect(row().lastError).toBe(diagnostic);

			await f.restart().tick();
			expect(hits).toHaveLength(2);

			for (let attempt = 2; attempt <= 9; attempt++) {
				f.at(start + attempt * 3_600_000);
				await f.restart().tick();
			}
			expect(hits.filter((url) => url === `/${failing}`)).toHaveLength(8);
			expect(row()).toMatchObject({ status: 'failed', attempts: 8 });
			expect(f.logs).toHaveLength(8);
			expect(f.logs[0]).toContain(diagnostic);
			expect(f.logs.join('\n')).not.toContain(origin);
		}));
