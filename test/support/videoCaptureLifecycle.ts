import { expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { videoCaptureFixture } from './videoCaptureFixture';
import type { TemporaryRepo } from './temporary.types';

export async function assertCaptureLifecycle(repo: TemporaryRepo) {
	const f = await videoCaptureFixture(repo),
		cold = await f.service.record(f.options());
	expect(cold.recorded).toHaveLength(2);
	expect(cold.reused).toEqual([]);
	expect(f.native.browserFactory).toHaveBeenCalledTimes(1);
	expect(f.native.record).toHaveBeenCalledTimes(2);
	f.publish(cold);
	const warm = await f.service.record(f.options());
	expect(warm.recorded).toEqual([]);
	expect(warm.reused).toHaveLength(2);
	expect(f.native.loadScript).toHaveBeenCalledTimes(2);
	expect(f.native.browserFactory).toHaveBeenCalledTimes(1);
	writeFileSync(join(repo.root, 'src/unrelated.ts'), 'export const unrelated = 2;');
	f.commit();
	const unrelated = await f.service.record(f.options());
	expect(unrelated.recorded).toEqual([]);
	expect(unrelated.captures.map((c) => c.server?.revision)).toEqual([
		cold.source.commit,
		cold.source.commit
	]);
	expect(unrelated.captures.map((c) => c.capturedAt)).toEqual(
		cold.captures.map((c) => c.capturedAt)
	);
	writeFileSync(join(repo.root, 'test/first.json'), '{"changed":true}');
	f.commit();
	const independent = await f.service.record(f.options());
	expect(independent.recorded.map((s) => s.clipId)).toEqual(['first']);
	expect(independent.reused.map((s) => s.clipId)).toEqual(['second']);
	f.publish(independent);
	writeFileSync(
		join(repo.root, 'src/player.ts'),
		'// @harness-uid u_abcdefghij\nexport const player = 2;'
	);
	f.commit();
	const shared = await f.service.record(f.options());
	expect(shared.recorded).toHaveLength(2);
	return f.registry.manifests.map((unit) => unit.id);
}
