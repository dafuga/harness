import { expect } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { videoCaptureFixture } from './videoCaptureFixture';
import type { TemporaryRepo } from './temporary.types';
import type { VideoCaptureSidecar } from '../../src/services/verification-evidence/VideoCaptureService.types';

export async function assertCaptureLifecycle(repo: TemporaryRepo) {
	const f = await videoCaptureFixture(repo),
		cold = await f.service.record(f.options());
	expect(cold.recorded).toHaveLength(2);
	expect(cold.reused).toEqual([]);
	expect(f.native.browserFactory).toHaveBeenCalledTimes(1);

	expect(f.native.record).toHaveBeenCalledTimes(2);
	f.publish(cold);
	const warmOptions = f.options();
	const warm = await f.service.record(warmOptions);
	expect(warm.recorded).toEqual([]);
	expect(warm.reused).toHaveLength(2);
	expect(f.native.loadScript).toHaveBeenCalledTimes(2);
	expect(f.native.browserFactory).toHaveBeenCalledTimes(1);
	const sidecar = JSON.parse(
		readFileSync(join(warmOptions.directory, 'video-batches.json'), 'utf8')
	) as VideoCaptureSidecar;
	const aliases = new Set(sidecar.captures.map((row) => row.file)).size;
	expect(sidecar.captures.map((row) => row.capture.path)).toEqual(warm.captures.map((c) => c.path));
	expect(warm.captures.every((capture) => capture.path.endsWith('/clip.mp4'))).toBe(true);
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
	return { registered: f.registry.manifests.map((unit) => unit.id), aliases };
}
