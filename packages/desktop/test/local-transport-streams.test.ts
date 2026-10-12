import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { RemoteBinary, WirePart } from '../../remote/src/index';
import { remoteBinary } from '../src/utils/remoteBinary';
import { largeImage, localFixture } from './local-transport-fixture';
import { git } from './run-fixture';

/** How many multipart messages were in flight at once, at most, in the order frames arrived. */
function widest(frames: string[]): { most: number; messages: number } {
	const flowing = new Set<number>(),
		started = new Set<number>();
	let most = 0;
	for (const part of frames.map((frame) => JSON.parse(frame) as WirePart)) {
		if (part.index === 0 && part.last) continue;
		started.add(part.message);
		if (part.last) flowing.delete(part.message);
		else flowing.add(part.message);
		most = Math.max(most, flowing.size);
	}
	return { most, messages: started.size };
}

test('nine large answers asked at once all arrive, within the stream bound of the socket', async () => {
	const f = await localFixture(),
		bytes = largeImage(),
		entityId = f.request.entityId,
		design = await f.planning.addDesign({
			entityId,
			prompt: 'Large fixture image',
			generator: { provider: 'codex', model: 'selected' },
			baseRevision: git(f.root, 'rev-parse', 'HEAD'),
			state: 'default',
			viewport: 'desktop',
			bytes
		}),
		commit = git(f.root, 'rev-parse', 'HEAD'),
		query = { entityId, commit, version: design.version, sha256: design.images[0].sha256 },
		held: (() => void)[] = [],
		pause = () => new Promise((resolve) => setTimeout(resolve, 0)),
		client = f.connect(f.window({ defer: (step) => held.push(step) }));
	await client.request('openProject');
	const before = f.frames.length,
		reads = Array.from({ length: 9 }, () => client.request<RemoteBinary>('image', query)),
		decoded = Promise.all(reads).then((answers) => Promise.all(answers.map(remoteBinary)));
	let images: Uint8Array[] | null = null;
	void decoded.then(
		(value) => (images = value),
		() => (images = [])
	);
	/* The socket stands still until eight have started and the ninth had time to try as well. */
	await expect.poll(() => widest(f.frames.slice(before)).messages, { timeout: 30000 }).toBe(8);
	await new Promise((resolve) => setTimeout(resolve, 1500));
	for (let step = 0; step < 6000 && images === null; step++) {
		held.shift()?.();
		await pause();
	}
	const { most, messages } = widest(f.frames.slice(before)),
		arrived = images ?? [];
	expect(arrived).toHaveLength(9);
	for (const image of arrived)
		expect(Buffer.compare(Buffer.from(image), Buffer.from(bytes))).toBe(0);
	expect(messages).toBe(9);
	expect(most).toBe(8);
	expect(f.transport.connections).toBe(1);
}, 90000);
