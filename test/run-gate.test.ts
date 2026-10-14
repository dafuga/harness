import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { cleanup, heldGate, holder, owner as started } from './support/gatedRuns';
import type { RunGate } from './support/runGate';

/**
 * The teardown of a browser run, held by a gate. Real processes own real run directories and end
 * with the real teardown module; what they seed is a SYNTHETIC stand-in (`test/support/fixtureOwner.ts`).
 * A gated run keeps its own history and media after its tests until it is let go, and then
 * removes what it owns and nothing of a run beside it.
 */
const scratch = mkdtempSync(join(tmpdir(), 'harness-run-gate-'));
// Passed or failed, each test's gates are closed and its processes ended before their files go.
afterEach(() => cleanup(5_000), 20_000);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A run directory owned by a process of its own, ended by the real teardown when told to. */
const owner = (gate?: string) => started(scratch, gate);
type Owner = Awaited<ReturnType<typeof owner>>;
/** What a run keeps: its history, the media named by their hash, and its frozen build. */
function kept(run: Owner) {
	const meta = join(run.root, 'console', 'meta.json');
	const media = existsSync(run.root)
		? readdirSync(run.root, { recursive: true, withFileTypes: true }).filter(
				(entry) => entry.isFile() && /^[0-9a-f]{64}\.png$/.test(entry.name)
			).length
		: 0;
	return {
		meta: existsSync(meta) ? readFileSync(meta, 'utf8') : null,
		media,
		build: existsSync(run.build)
	};
}
/** Tells a run its tests finished; resolves once its teardown waits at the gate, or has ended. */
async function finished(run: Owner, reached: Promise<unknown>) {
	run.finish();
	await Promise.race([reached, run.returned]);
	return run.status();
}
/** The peer ends without a gate: it removes its own fixtures, which were untouched until then. */
async function peerAfter(peer: Owner, before: ReturnType<typeof kept>) {
	expect(kept(peer)).toEqual(before);
	peer.finish();
	await peer.returned;
	expect(kept(peer)).toEqual({ meta: null, media: 0, build: false });
}
async function gated(name: string): Promise<[RunGate, Owner, Owner]> {
	const gate = await heldGate(scratch, name);
	return [gate, await owner(gate.path), await owner()];
}

test('a gated run keeps its history and media after its tests until released, then removes only its own', async () => {
	const [gate, mine, peer] = await gated('release');
	const before = [kept(mine), kept(peer)];
	expect(before.map((run) => run.media > 0 && run.build && run.meta !== null)).toEqual([
		true,
		true
	]);
	const state = await finished(mine, gate.reached);
	expect(kept(mine)).toEqual(before[0]);
	expect(state).toBe('pending');
	expect(await gate.reached).toBe(mine.root);
	gate.release();
	await mine.returned;
	expect(kept(mine)).toEqual({ meta: null, media: 0, build: false });
	await gate.close();
	await peerAfter(peer, before[1]);
}, 30_000);

test('a gate that is closed lets its waiting run remove its own fixtures', async () => {
	const [gate, mine, peer] = await gated('close');
	const before = [kept(mine), kept(peer)];
	const state = await finished(mine, gate.reached);
	expect(kept(mine)).toEqual(before[0]);
	expect(state).toBe('pending');
	await gate.close();
	await mine.returned;
	expect(kept(mine)).toEqual({ meta: null, media: 0, build: false });
	await peerAfter(peer, before[1]);
}, 30_000);

test('a run whose gate nobody holds removes its own fixtures at once, as one without a gate does', async () => {
	for (const gate of [join(scratch, 'nobody.gate'), undefined]) {
		const [mine, peer] = [await owner(gate), await owner()];
		const before = kept(peer);
		mine.finish();
		await mine.returned;
		expect(kept(mine)).toEqual({ meta: null, media: 0, build: false });
		await peerAfter(peer, before);
	}
}, 30_000);

test('when the process that holds the gate dies, its waiting run removes its own fixtures', async () => {
	const held = await holder(scratch, 'holder');
	const [mine, peer] = [await owner(held.path), await owner()];
	const before = [kept(mine), kept(peer)];
	const state = await finished(mine, held.reached);
	expect(kept(mine)).toEqual(before[0]);
	expect(state).toBe('pending');
	held.child.kill('SIGKILL');
	await mine.returned;
	expect(kept(mine)).toEqual({ meta: null, media: 0, build: false });
	await peerAfter(peer, before[1]);
}, 30_000);
