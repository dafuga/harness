import type * as S3 from '@aws-sdk/client-s3';
import { afterEach, expect, test, vi } from 'vitest';
import { rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ReportCommandService } from '../src/services/ReportCommandService';
import { R2EvidenceStoreAdapter } from '../src/adapters/R2EvidenceStoreAdapter';
import { atomicJson } from '../src/utils/reportFiles';
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
test('canonical reports cannot silently disable configured cloud storage', () => {
	configureFixtureCloud();
	vi.stubEnv('NODE_ENV', 'production');
	vi.stubEnv('PROJECT_REPORTS_HOME', join(homedir(), '.codex', 'project-reports'));
	vi.stubEnv('PROJECT_REPORTS_ASSET_STORAGE', 'local');
	expect(() => R2EvidenceStoreAdapter.fromEnvironment()).toThrow(/temporary test/);
	vi.stubEnv('NODE_ENV', 'test');
	expect(() => R2EvidenceStoreAdapter.fromEnvironment()).toThrow(/temporary test/);
});
test('finalized evidence backfills once, preserves proof and dates, and supports a side-effect-free preview', async () => {
	const { root, repository, report } = await storageFixture();
	roots.push(root);
	report.state = 'finalized';
	await atomicJson(join(repository.directory(report.id), 'manifest.json'), report);
	const before = structuredClone(report);
	configureFixtureCloud();
	const command = new ReportCommandService(repository);
	await command.execute(['sync-storage', '--run', report.id, '--dry-run']);
	expect(cloud.objects.size).toBe(0);
	expect(await repository.get(report.id)).toEqual(before);
	await command.execute(['sync-storage', '--run', report.id]);
	const after = await repository.get(report.id);
	expect(after.evidence[0].storage).toBe('r2-evidence');
	delete after.evidence[0].storage;
	expect(after).toEqual(before);
	expect([...cloud.objects.values()][0]).toEqual(
		await readFile(join(repository.directory(report.id), 'assets', report.evidence[0].file))
	);
	await command.execute(['sync-storage', '--run', report.id]);
	expect(cloud.calls.filter((c) => c === 'PutObjectCommand')).toHaveLength(1);
});
test('expired reports are never backfilled or resurrected by uploads', async () => {
	const { root, repository, report } = await storageFixture('2000-01-01T00:00:00.000Z');
	roots.push(root);
	configureFixtureCloud();
	await new ReportCommandService(repository).execute(['sync-storage', '--run', report.id]);
	expect(cloud.objects.size).toBe(0);
});
