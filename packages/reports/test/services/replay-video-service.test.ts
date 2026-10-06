import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ReplayVideoService } from '../../src/services/ReplayVideoService';
import { reportProcess } from '../../src/utils/reportProcess';
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'replay-test-'));
	roots.push(root);
	const repo = new ReportRepository(root);
	const report = await repo.begin({
		project: '/tmp/game',
		title: 'Replay',
		mode: 'feature',
		environment: 'fixture'
	});
	return { root, repo, report, service: new ReplayVideoService(repo) };
}
test('video exports only registered frames as a playable ordered MP4 and caches the artifact', async () => {
	const { root, repo, report, service } = await fixture();
	const png = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=',
		'base64'
	);
	const file = join(root, 'frame.png');
	await writeFile(file, png);
	for (const order of [1, 2])
		await repo.record(report.id, {
			kind: 'evidence',
			data: {
				id: 'f' + order,
				title: 'Scene ' + order,
				path: file,
				category: 'Game',
				status: 'passed',
				order
			}
		});
	const bytes = await service.create(report.id);
	expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
	const target = join(root, 'test.mp4');
	await writeFile(target, bytes);
	const probe = await reportProcess(
		'ffprobe',
		[
			'-v',
			'error',
			'-select_streams',
			'v:0',
			'-show_entries',
			'stream=width,height,nb_frames,duration',
			'-of',
			'json',
			target
		],
		root
	);
	expect(probe.code).toBe(0);
	expect(JSON.parse(probe.output).streams[0]).toMatchObject({
		width: 1280,
		height: 720,
		nb_frames: '60'
	});
	expect(await service.create(report.id)).toEqual(bytes);
	expect((await readdir(join(repo.directory(report.id), 'replays'))).length).toBe(1);
}, 20000);
test('empty and expired captures cannot produce a fake video', async () => {
	const { service, report } = await fixture();
	await expect(service.create(report.id)).rejects.toThrow('available screenshots');
});
test('a copied report ID cannot select arbitrary filesystem paths', async () => {
	const { service } = await fixture();
	await expect(service.create('../private')).rejects.toThrow();
});
