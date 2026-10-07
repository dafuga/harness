import type * as S3 from '@aws-sdk/client-s3';
import { afterEach, expect, test, vi } from 'vitest';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportCommandService } from '../src/services/ReportCommandService';
import { configureFixtureCloud, fixtureCloudResponse, storageFixture } from './storageFixture';
const cloud = vi.hoisted(() => ({
	objects: new Map<string, Buffer>(),
	calls: [] as string[],
	failDelete: false
}));
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
	vi.useRealTimers();
	vi.unstubAllEnvs();
	cloud.objects.clear();
	cloud.calls.length = 0;
	cloud.failDelete = false;
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('30-day cleanup removes every owned copy, preserves fresh reports and unrelated keys, and previews without writes', async () => {
	vi.setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
	const { root, repository, report } = await storageFixture('2026-10-02T12:00:00.000Z');
	roots.push(root);
	const recent = await repository.begin({
		project: '/tmp/recent',
		title: 'Fresh',
		mode: 'feature',
		environment: 'fixture'
	});
	const directory = repository.directory(report.id);
	for (const sub of ['assets', 'exports', 'replays']) {
		await mkdir(join(directory, sub), { recursive: true });
		await writeFile(join(directory, sub, 'copy'), 'proof');
	}
	const prefixes = ['report-evidence/runs/', 'uploaded-screenshots/runs/', 'published-reports/'];
	for (const p of prefixes) {
		cloud.objects.set(p + report.id + '/copy', Buffer.from('old'));
		cloud.objects.set(p + recent.id + '/copy', Buffer.from('fresh'));
	}
	cloud.objects.set('unrelated/private', Buffer.from('keep'));
	configureFixtureCloud();
	const command = new ReportCommandService(repository);
	await command.execute(['cleanup', '--dry-run']);
	expect(cloud.objects.size).toBe(7);
	expect(await stat(directory)).toBeTruthy();
	await command.execute(['cleanup']);
	await expect(stat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
	expect(await repository.get(recent.id)).toMatchObject({ id: recent.id });
	expect([...cloud.objects.keys()]).toEqual([
		...prefixes.map((p) => p + recent.id + '/copy'),
		'unrelated/private'
	]);
	await command.execute(['cleanup']);
	expect(cloud.objects.size).toBe(4);
});
test('a cloud deletion failure preserves local proof for retries', async () => {
	const { root, repository, report } = await storageFixture('2000-01-01T00:00:00.000Z');
	roots.push(root);
	const manifest = join(repository.directory(report.id), 'manifest.json');
	const before = await readFile(manifest);
	configureFixtureCloud();
	cloud.objects.set('report-evidence/runs/' + report.id + '/copy', Buffer.from('old'));
	cloud.failDelete = true;
	await new ReportCommandService(repository).execute(['cleanup']);
	expect(await readFile(manifest)).toEqual(before);
	expect(cloud.objects.size).toBe(1);
	cloud.failDelete = false;
	await new ReportCommandService(repository).execute(['cleanup']);
	await expect(stat(manifest)).rejects.toMatchObject({ code: 'ENOENT' });
	expect(cloud.objects.size).toBe(0);
});
