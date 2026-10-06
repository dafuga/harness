import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AudioUploadService } from '../../src/services/AudioUploadService';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { audioFixture } from '../audioFixture';
const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'audio-upload-'));
	roots.push(root);
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/audio',
		title: 'Audio upload',
		mode: 'feature',
		environment: 'local fixture'
	});
	const input = {
		title: 'Fresh sound',
		audio: new File([audioFixture()], 'voice.wav'),
		note: 'Recognition failed',
		source: 'Synthetic fixture'
	};
	return { store, run, input, service: new AudioUploadService(store) };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('uploads locally with original bytes and not-proven status', async () => {
	const { store, run, input, service } = await fixture();
	const result = await service.upload(run.id, input);
	expect(result.evidence[0]).toMatchObject({
		mediaType: 'audio',
		durationSeconds: 3,
		status: 'not-proven',
		note: input.note,
		source: input.source
	});
	expect(result.evidence[0].capturedAt).toBeUndefined();
	expect(await readFile(join(store.directory(run.id), 'assets', result.evidence[0].file))).toEqual(
		audioFixture()
	);
});
test('invalid content and finalized reports never gain uploaded evidence', async () => {
	const { store, run, input, service } = await fixture();
	await expect(
		service.upload(run.id, { ...input, audio: new File(['fake'], 'fake.wav') })
	).rejects.toThrow();
	expect((await store.get(run.id)).evidence).toHaveLength(0);
	await store.seal(run.id);
	await store.finish(run.id, { html: 'index.html', pdf: 'report.pdf', zip: 'report.zip' });
	await expect(service.upload(run.id, input)).rejects.toThrow(/finaliz/);
	expect((await store.get(run.id)).evidence).toHaveLength(0);
});
test('paired upload retains both original files with one comparison and independent phases', async () => {
	const { store, run, input, service } = await fixture();
	const comparison = {
		...input,
		before: new File([audioFixture(3, 220)], 'before.wav'),
		after: new File([audioFixture(3, 440)], 'after.wav')
	};
	const result = await service.uploadComparison(run.id, comparison);
	expect(result.evidence.map((item) => item.phase)).toEqual(['before', 'after']);
	expect(result.evidence[0].comparison).toBeTruthy();
	expect(result.evidence[1].comparison).toBe(result.evidence[0].comparison);
	for (const [index, frequency] of [
		[0, 220],
		[1, 440]
	]) {
		expect(result.evidence[index]).toMatchObject({
			mediaType: 'audio',
			status: 'not-proven',
			source: input.source
		});
		expect(
			await readFile(join(store.directory(run.id), 'assets', result.evidence[index].file))
		).toEqual(audioFixture(3, frequency));
	}
});
test('a bad second audio file or finalized history adds neither comparison member', async () => {
	const { store, run, input, service } = await fixture();
	const comparison = { ...input, before: input.audio, after: new File(['fake'], 'fake.wav') };
	await expect(service.uploadComparison(run.id, comparison)).rejects.toThrow();
	expect((await store.get(run.id)).evidence).toHaveLength(0);
	await store.seal(run.id);
	await store.finish(run.id, { html: 'index.html', pdf: 'report.pdf', zip: 'report.zip' });
	await expect(
		service.uploadComparison(run.id, { ...comparison, after: input.audio })
	).rejects.toThrow(/finaliz/);
	expect((await store.get(run.id)).evidence).toHaveLength(0);
});
