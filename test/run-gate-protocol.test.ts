import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { cleanup, heldGate } from './support/gatedRuns';
import { eachLine, openRunGate } from './support/runGate';

/**
 * WHAT A GATE AND A WAITING TEARDOWN SAY TO EACH OTHER. One line each way over a real Unix socket:
 * the directory of the run, then `release`. The gate acts on whole lines however their bytes are
 * split across reads, gives up on a line that grows too long, and tells each run once. How the
 * teardown reads its side is held in the reports package, beside it
 * (`packages/reports/test/utils/teardown-gate.test.ts`).
 */
const scratch = mkdtempSync(join(tmpdir(), 'harness-gate-protocol-'));
const sockets: Socket[] = [];
const servers: Server[] = [];
afterEach(async () => {
	for (const socket of sockets.splice(0)) socket.destroy();
	await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
	await cleanup(5_000);
}, 20_000);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function connect(path: string): Promise<Socket> {
	return new Promise((done, failed) => {
		const socket = createConnection(path, () => done(socket));
		socket.once('error', failed);
		sockets.push(socket);
	});
}
/** All a socket receives until it closes. */
function heard(socket: Socket): Promise<string> {
	let text = '';
	socket.setEncoding('utf8');
	socket.on('data', (chunk: string) => (text += chunk));
	return new Promise((done) => socket.once('close', () => done(text)));
}
function refused(path: string): Promise<boolean> {
	return new Promise((done) => {
		const socket = createConnection(path, () => {
			socket.destroy();
			done(false);
		});
		socket.once('error', () => done(true));
	});
}
/** Both ends of one real Unix socket: the one a server accepted and the one that connected. */
async function pair(name: string) {
	const server = createServer();
	servers.push(server);
	await new Promise<void>((done) => server.listen(join(scratch, `${name}.sock`), done));
	const accepting = once(server, 'connection') as Promise<[Socket]>;
	const connected = await connect(join(scratch, `${name}.sock`));
	const [accepted] = await accepting;
	sockets.push(accepted);
	return { accepted, connected };
}
/** Writes one piece, and resolves with the read it arrived in once the reader has seen it. */
async function delivered(from: Socket, to: Socket, piece: string): Promise<string> {
	const read = once(to, 'data');
	from.write(piece);
	const [chunk] = (await read) as [string];
	return chunk;
}

test('the gate reads a line split across reads as one line, and gives up on too long a line', async () => {
	const { accepted, connected } = await pair('lines');
	const lines: string[] = [];
	eachLine(accepted, (line) => lines.push(line));
	const reads: Array<[string, string[]]> = [];
	for (const piece of ['/tmp/harness-', 'e2e-split', '\nsecond', ' line\n'])
		reads.push([await delivered(connected, accepted, piece), [...lines]]);
	expect(reads).toEqual([
		['/tmp/harness-', []],
		['e2e-split', []],
		['\nsecond', ['/tmp/harness-e2e-split']],
		[' line\n', ['/tmp/harness-e2e-split', 'second line']]
	]);
	const gone = once(accepted, 'close');
	connected.write('x'.repeat(4097));
	await gone;
	expect(lines).toHaveLength(2);
});

test('the gate drops a whole line that is too long before reading it, and reads one at the bound', async () => {
	const [at, over] = [await pair('at-bound'), await pair('over-bound')];
	const lines: string[][] = [[], []];
	const outcome = [at, over].map(
		({ accepted }, side) =>
			new Promise<string>((done) => {
				eachLine(accepted, (line) => {
					lines[side].push(line);
					done('read');
				});
				accepted.once('close', () => done('dropped'));
			})
	);
	at.connected.write(`${'y'.repeat(4096)}\n`);
	over.connected.write(`${'x'.repeat(4097)}\nafter\n`);
	expect(await Promise.all(outcome)).toEqual(['read', 'dropped']);
	expect(lines.map((read) => read.map((line) => line.length))).toEqual([[4096], []]);
});

test('a gate that cannot listen rejects with the reason, and the gate already there still works', async () => {
	const gate = await heldGate(scratch, 'taken');
	await expect(openRunGate(scratch, 'taken')).rejects.toMatchObject({ code: 'EADDRINUSE' });
	const missing = join(scratch, 'missing');
	// A socket in a directory that is not there: macOS says EACCES, Linux ENOENT.
	const bind = expect.stringMatching(/^(EACCES|ENOENT)$/);
	await expect(openRunGate(missing, 'gate')).rejects.toMatchObject({ code: bind });
	await expect(openRunGate(join(scratch, 'x'.repeat(100)), 'gate')).rejects.toThrow('too long');
	expect(existsSync(missing)).toBe(false);
	const run = await connect(gate.path);
	const reply = heard(run);
	run.write('/tmp/harness-e2e-taken\n');
	expect(await gate.reached).toBe('/tmp/harness-e2e-taken');
	gate.release();
	expect(await reply).toBe('release\n');
});

test('the gate names a run by its first whole line, tells each run once, and closes once', async () => {
	const gate = await heldGate(scratch, 'once');
	const cut = await connect(gate.path);
	const nothing = heard(cut);
	cut.end('/tmp/never-finished');
	expect(await nothing).toBe('');
	const [run, early, dead] = [
		await connect(gate.path),
		await connect(gate.path),
		await connect(gate.path)
	];
	const replies = [heard(run), heard(early)];
	for (const piece of ['/tmp/harness-', 'e2e-once\n', 'more\n']) run.write(piece);
	expect(await gate.reached).toBe('/tmp/harness-e2e-once');
	// A run that is gone is not told; one that connected before the release is told once.
	dead.destroy();
	gate.release();
	gate.release();
	early.write('/tmp/early\n');
	const late = await connect(gate.path);
	replies.push(heard(late));
	late.write('/tmp/late\n');
	expect(await Promise.all(replies)).toEqual(['release\n', 'release\n', 'release\n']);
	const closing = gate.close();
	expect(gate.close()).toBe(closing);
	await closing;
	gate.release();
	expect(gate.close()).toBe(closing);
	expect(await refused(gate.path)).toBe(true);
});
