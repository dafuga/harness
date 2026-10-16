import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { releasedBy } from '../../tests/e2e/support/removeFixtures';

/**
 * A browser run started with HARNESS_E2E_TEARDOWN_GATE waits at that gate after its specs. Over a
 * real Unix socket, its teardown goes on at a whole `release` line however the bytes are split
 * across reads, and at nothing less; and it waits no longer when the gate ends mid-line, sends too
 * long a line, or is not there.
 */
const scratch = mkdtempSync(join(tmpdir(), 'reports-teardown-gate-'));
const sockets: Socket[] = [];
const servers: Server[] = [];
afterEach(async () => {
	for (const socket of sockets.splice(0)) socket.destroy();
	await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Both ends of one real Unix socket: the gate's, which a server accepted, and the run's. */
async function pair(name: string) {
	const server = createServer();
	servers.push(server);
	const path = join(scratch, `${name}.sock`);
	await new Promise<void>((done) => server.listen(path, done));
	const accepting = once(server, 'connection') as Promise<[Socket]>;
	const run = createConnection(path);
	sockets.push(run);
	await once(run, 'connect');
	const [gate] = await accepting;
	sockets.push(gate);
	return { gate, run };
}
/** Writes one piece, and resolves with the read it arrived in once the reader has seen it. */
async function delivered(from: Socket, to: Socket, piece: string): Promise<string> {
	const read = once(to, 'data');
	from.write(piece);
	const [chunk] = (await read) as [string];
	return chunk;
}

test('the teardown goes on at a whole release line however it is split, and at nothing less', async () => {
	const { gate, run } = await pair('release');
	const waited = releasedBy(run);
	const reads: Array<[string, boolean]> = [];
	for (const piece of ['released\nrel', 'ease', '\n'])
		reads.push([await delivered(gate, run, piece), run.writableEnded]);
	expect(reads).toEqual([
		['released\nrel', false],
		['ease', false],
		['\n', true]
	]);
	await expect(waited).resolves.toBeUndefined();
});

test('a gate that ends mid-line, sends too long a line, or is not there holds the teardown no longer', async () => {
	const [cut, long] = [await pair('cut'), await pair('long')];
	const waits = [releasedBy(cut.run), releasedBy(long.run)];
	cut.gate.end('rel');
	long.gate.write('x'.repeat(4097));
	const nowhere = createConnection(join(scratch, 'nobody.gate'));
	sockets.push(nowhere);
	waits.push(releasedBy(nowhere));
	await expect(Promise.all(waits)).resolves.toEqual([undefined, undefined, undefined]);
	expect([cut.run.destroyed, long.run.destroyed, nowhere.destroyed]).toEqual([true, true, true]);
});

test('a gate whose whole line is too long is not obeyed, even when a release follows it', async () => {
	const { gate, run } = await pair('over');
	const waited = releasedBy(run);
	gate.write(`${'x'.repeat(4097)}\nrelease\n`);
	await expect(waited).resolves.toBeUndefined();
	expect([run.writableEnded, run.destroyed]).toEqual([false, true]);
});
