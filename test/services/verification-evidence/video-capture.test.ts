import { expect, test, vi, afterEach } from 'vitest';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VideoCaptureService } from '../../../src/services/verification-evidence/VideoCaptureService';
import { withTempRepo } from '../../support/temporary';
import { videoCaptureFixture, captureDeclaration } from '../../support/videoCaptureFixture';
import { assertCaptureLifecycle } from '../../support/videoCaptureLifecycle';
import { VideoEvidenceService } from '../../../src/services/verification-evidence/VideoEvidenceService';

afterEach(() => vi.restoreAllMocks());

test('VideoCaptureService runs', () => {
	expect(new VideoCaptureService().run()).toBe('video-capture');
});

test('capture orchestration retains original clips without creating warm browser work', async () => {
	expect(typeof new VideoCaptureService().record).toBe('function');
	await withTempRepo(assertCaptureLifecycle);
}, 30_000);

test('capture orchestration refuses unbound recording before scripts or browser creation', async () => {
	expect(typeof new VideoCaptureService().record).toBe('function');
	await withTempRepo(async (repo) => {
		const f = await videoCaptureFixture(repo);
		for (const patch of [
			{ recordingAuthorization: undefined },
			{ env: {} },
			{ env: { CI: '1', HARNESS_VIDEO_RECORD_TASK: 'video-build-20261115' } }
		])
			await expect(f.service.record({ ...f.options(), ...patch })).rejects.toThrow(
				/not authorized/
			);
		expect(f.native.browserFactory).not.toHaveBeenCalled();
		expect(f.native.loadScript).not.toHaveBeenCalled();
	});
});

test('capture orchestration observes configured boundary signatures and preserves failed raw data', async () => {
	expect(typeof new VideoCaptureService().record).toBe('function');
	await withTempRepo(async (repo) => {
		const f = await videoCaptureFixture(repo),
			options = f.options();
		const declaration = structuredClone(captureDeclaration);
		Object.assign(declaration.clips[0], {
			checkpoints: [
				{ viewport: 'desktop', entrySignature: 'a'.repeat(64), exitSignature: 'b'.repeat(64) }
			]
		});
		await expect(f.service.record({ ...options, declaration })).rejects.toThrow(/callback/);
		expect(f.native.browserFactory).not.toHaveBeenCalled();
		const script = await f.native.loadScript({} as never);
		let calls = 0;
		const checkpoint = vi.fn(async () => (++calls === 1 ? 'a' : 'b').repeat(64));
		const result = await f.service.record({
			...f.options(),
			declaration,
			loadScript: async () => ({ ...script, checkpoint })
		});
		expect(result.captures[0].video).toMatchObject({
			entrySignature: 'a'.repeat(64),
			exitSignature: 'b'.repeat(64)
		});
		expect(checkpoint).toHaveBeenCalledTimes(4);
		await expect(
			f.service.record({
				...f.options(),
				declaration,
				loadScript: async () => ({ ...script, checkpoint: async () => 'c'.repeat(64) })
			})
		).rejects.toThrow(/entry.*checkpoint/);
		expect(result.raw.every((raw) => existsSync(raw.directory))).toBe(true);
	});
}, 30_000);

test('capture orchestration cleans owned raw only after an attached matching receipt', async () => {
	expect(typeof new VideoCaptureService().record).toBe('function');
	await withTempRepo(async (repo) => {
		const f = await videoCaptureFixture(repo),
			options = f.options();
		const result = await f.service.record(options);
		expect(result.raw.every((raw) => existsSync(raw.directory))).toBe(true);
		expect(existsSync(join(options.directory, result.captures[0].path))).toBe(false);
		const sidecar = JSON.parse(readFileSync(join(options.directory, 'video-batches.json'), 'utf8'));
		expect(sidecar.captures).toHaveLength(2);
		await expect(f.service.acknowledge(result, 'a'.repeat(64))).rejects.toThrow(/attached|receipt/);
		expect(f.native.acknowledge).not.toHaveBeenCalled();
		f.publish(result);
		await f.service.acknowledge(result, 'a'.repeat(64));
		expect(f.native.acknowledge).toHaveBeenCalledTimes(2);
		expect(result.raw.every((raw) => !existsSync(raw.directory))).toBe(true);
	});
}, 30_000);

test('capture orchestration re-records a corrupt sibling and bypasses old native cache for uncertain inputs', async () => {
	expect(typeof new VideoCaptureService().record).toBe('function');
	await withTempRepo(async (repo) => {
		const f = await videoCaptureFixture(repo),
			cold = await f.service.record(f.options());
		f.publish(cold);
		f.references.resolve.mockImplementationOnce(async () => {
			throw new Error('missing selected object');
		});
		const repaired = await f.service.record(f.options());
		expect(repaired.recorded.map((s) => s.clipId)).toEqual(['first']);
		expect(repaired.reused.map((s) => s.clipId)).toEqual(['second']);
		writeFileSync(join(repo.root, 'src/player.ts'), 'import(variable);');
		f.commit();
		const unknown = await f.service.record(f.options());
		f.publish(unknown);
		const options = f.options();
		const slots = new VideoEvidenceService(repo.root)
			.plan(captureDeclaration)
			.record.map((slot) => ({
				...slot,
				reasons: ['recording required: unresolved dynamic input']
			}));
		options.env!.HARNESS_VIDEO_CAPTURE_CONTEXT = JSON.stringify({
			schemaVersion: 1,
			snapshot: repo.root,
			source: options.source,
			slots
		});
		const again = await f.service.record(options);
		expect(again.recorded).toHaveLength(2);
		expect(new Set(f.native.cacheRoots).size).toBe(f.native.cacheRoots.length);
	});
}, 30_000);
