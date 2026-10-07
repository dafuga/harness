import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { ReportRepository } from '../src/repositories/ReportRepository';
import { atomicJson } from '../src/utils/reportFiles';
export const fixturePng = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII=',
	'base64'
);
export function configureFixtureCloud() {
	for (const key of ['ACCOUNT_ID', 'BUCKET', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY'])
		vi.stubEnv('PROJECT_REPORTS_R2_' + key, 'fixture');
	vi.stubEnv('PROJECT_REPORTS_ASSET_STORAGE', '');
}
export async function storageFixture(startedAt?: string) {
	vi.stubEnv('PROJECT_REPORTS_ASSET_STORAGE', 'local');
	const root = await mkdtemp(join(tmpdir(), 'report-retention-'));
	const repository = new ReportRepository(root);
	const report = await repository.begin({
		project: '/tmp/source-project',
		title: 'Original proof',
		mode: 'feature',
		environment: 'fixture'
	});
	const image = join(root, 'source.png');
	await writeFile(image, fixturePng);
	await repository.record(report.id, {
		kind: 'evidence',
		data: { id: 'frame', title: 'Original frame', path: image, status: 'passed', category: 'Proof' }
	});
	const ready = await repository.get(report.id);
	if (startedAt) ready.startedAt = startedAt;
	await atomicJson(join(repository.directory(report.id), 'manifest.json'), ready);
	return { root, repository, report: ready };
}
export interface FixtureCloud {
	objects: Map<string, Buffer>;
	failDelete?: boolean;
	calls: string[];
}
export function fixtureCloudResponse(
	cloud: FixtureCloud,
	command: { constructor: { name: string }; input: Record<string, unknown> }
) {
	const { Key, Prefix, Delete } = command.input;
	const key = String(Key || '');
	cloud.calls.push(command.constructor.name);
	if (command.constructor.name === 'PutObjectCommand')
		cloud.objects.set(key, Buffer.from(command.input.Body as Buffer));
	if (command.constructor.name === 'GetObjectCommand') {
		if (!cloud.objects.has(key)) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
		return { Body: { transformToByteArray: async () => cloud.objects.get(key) } };
	}
	if (command.constructor.name === 'ListObjectsV2Command')
		return {
			Contents: [...cloud.objects.keys()]
				.filter((k) => k.startsWith(String(Prefix)))
				.map((Key) => ({ Key, LastModified: new Date() }))
		};
	if (command.constructor.name === 'DeleteObjectsCommand') {
		if (cloud.failDelete) return { Errors: [{ Code: 'AccessDenied' }] };
		for (const item of (Delete as { Objects: { Key: string }[] }).Objects)
			cloud.objects.delete(item.Key);
	}
	return {};
}
