import { afterEach, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../src/repositories/ReportRepository';
import { ReportExportService } from '../src/services/ReportExportService';
import { audioFixture } from './audioFixture';
const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'report-audio-'));
	roots.push(root);
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/audio-project',
		title: 'Audio review',
		mode: 'feature',
		environment: 'synthetic fixture'
	});
	const source = join(root, 'sound.wav');
	await writeFile(source, audioFixture());
	const record = {
		kind: 'evidence' as const,
		data: {
			id: 'sound',
			title: 'Recorded sound',
			path: source,
			status: 'failed',
			source: 'Synthetic transport test',
			transcript: 'Test tone',
			capturedAt: '2026-09-26T12:00:00Z'
		}
	};
	return { root, store, run, source, record };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('records original WAV bytes, duration and provenance without changing the outcome', async () => {
	const { store, run, source, record } = await fixture();
	const updated = await store.record(run.id, record);
	const item = updated.evidence[0];
	expect(item).toMatchObject({
		mediaType: 'audio',
		durationSeconds: 3,
		mimeType: 'audio/wav',
		status: 'failed',
		transcript: 'Test tone',
		capturedAt: record.data.capturedAt
	});
	expect(await readFile(join(store.directory(run.id), 'assets', item.file))).toEqual(
		await readFile(source)
	);
});
test('rejects disguised audio and symlinks without adding evidence', async () => {
	const { store, run, source, record, root } = await fixture();
	await writeFile(source, '<html>fake WAV</html>');
	await expect(store.record(run.id, record)).rejects.toThrow();
	const link = join(root, 'linked.wav');
	await symlink(source, link);
	await expect(
		store.record(run.id, { ...record, data: { ...record.data, path: link } })
	).rejects.toThrow(/symlink/);
	expect((await store.get(run.id)).evidence).toHaveLength(0);
});
test('audio survives portable HTML and PDF finalization', async () => {
	const { store, run, record } = await fixture();
	await store.record(run.id, record);
	const final = await new ReportExportService(store).finalize(run.id);
	expect(final.status).toBe('failed');
	const html = await readFile(join(store.directory(run.id), 'exports', 'index.html'), 'utf8');
	expect(html).toContain('data:audio/wav;base64,');
	expect(html).toContain('Recorded sound');
	expect(
		(await readFile(join(store.directory(run.id), 'exports', 'report.pdf')))
			.subarray(0, 4)
			.toString()
	).toBe('%PDF');
	await expect(store.record(run.id, record)).rejects.toThrow(/finaliz/);
});
test('missing audio becomes not proven and exports omit its bytes', async () => {
	const { store, run, record } = await fixture();
	const updated = await store.record(run.id, record);
	await unlink(join(store.directory(run.id), 'assets', updated.evidence[0].file));
	const final = await new ReportExportService(store).finalize(run.id);
	expect(final.evidence[0]).toMatchObject({ missing: true, status: 'not-proven' });
	expect(
		await readFile(join(store.directory(run.id), 'exports', 'index.html'), 'utf8')
	).not.toContain('data:audio/wav;base64,');
});
