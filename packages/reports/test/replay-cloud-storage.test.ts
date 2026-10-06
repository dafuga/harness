import type * as S3 from '@aws-sdk/client-s3';
import { afterEach, expect, test, vi } from 'vitest';
import { rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReplayVideoService } from '../src/services/ReplayVideoService';
import { ReportCommandService } from '../src/services/ReportCommandService';
import { configureFixtureCloud, fixtureCloudResponse, storageFixture } from './storageFixture';
const cloud = vi.hoisted(() => ({ objects: new Map<string, Buffer>(), calls: [] as string[] }));
vi.mock('@aws-sdk/client-s3', async (load) => ({
	...(await load<typeof S3>()),
	S3Client: class {
		async send(command: Parameters<typeof fixtureCloudResponse>[1]) {
			return fixtureCloudResponse(cloud, command);
		}
	}
}));
const roots: string[] = [];
afterEach(async () => {
	vi.unstubAllEnvs();
	cloud.objects.clear();
	cloud.calls.length = 0;
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('replay generation uploads a real MP4 and restores the same bytes from R2 without ffmpeg', async () => {
	const { root, repository, report } = await storageFixture();
	roots.push(root);
	configureFixtureCloud();
	const service = new ReplayVideoService(repository);
	const bytes = await service.create(report.id);
	expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
	const video = [...cloud.objects.entries()].find(([key]) => key.endsWith('.mp4'));
	expect(video?.[1]).toEqual(bytes);
	const directory = join(repository.directory(report.id), 'replays');
	for (const name of await readdir(directory))
		if (name.endsWith('.mp4')) await rm(join(directory, name));
	vi.stubEnv('PROJECT_REPORTS_FFMPEG', '/missing-ffmpeg');
	expect(await service.create(report.id)).toEqual(bytes);
	expect(cloud.calls.filter((c) => c === 'PutObjectCommand')).toHaveLength(1);
}, 20000);
test('backfill uploads existing locally generated MP4s without changing the clip', async () => {
	const { root, repository, report } = await storageFixture();
	roots.push(root);
	const service = new ReplayVideoService(repository);
	await service.create(report.id);
	const directory = join(repository.directory(report.id), 'replays');
	const name = (await readdir(directory)).find((n) => n.endsWith('.mp4'))!;
	const before = await readFile(join(directory, name));
	configureFixtureCloud();
	await new ReportCommandService(repository).execute(['sync-storage', '--run', report.id]);
	expect([...cloud.objects.entries()].find(([key]) => key.endsWith('.mp4'))?.[1]).toEqual(before);
	expect(await readFile(join(directory, name))).toEqual(before);
}, 20000);
