import { afterEach, expect, test, vi } from 'vitest';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportPublishService } from '../../src/services/ReportPublishService';
import { R2EvidenceStoreAdapter } from '../../src/adapters/R2EvidenceStoreAdapter';
import { publicationFixture } from '../publicationFixture';
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
function storage() {
	const send = vi.fn().mockResolvedValue({});
	return {
		send,
		store: new R2EvidenceStoreAdapter(
			{ accountId: 'fake', bucket: 'reports-only', accessKeyId: 'test', secretAccessKey: 'test' },
			{ send } as unknown as S3Client
		)
	};
}
test('verified publication writes a separate receipt and keeps the failed manifest unchanged', async () => {
	const { root, repository, run } = await publicationFixture();
	roots.push(root);
	const { send, store } = storage();
	const frozen = await readFile(join(repository.directory(run.id), 'manifest.json'));
	const deploy = vi.fn().mockResolvedValue('https://abc.project-report-shares.pages.dev');
	const verify = vi.fn().mockResolvedValue(undefined);
	const receipt = await new ReportPublishService(repository, store, deploy, verify).publish(run.id);
	expect(send).toHaveBeenCalledTimes(4);
	expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
	expect(send.mock.calls[0][0].input.Key).toBe(
		`published-reports/${run.id}/${receipt.digest}/index.html`
	);
	expect(deploy).toHaveBeenCalledTimes(1);
	expect(verify).toHaveBeenCalledTimes(1);
	expect(JSON.parse(await readFile(join(root, 'publications', run.id + '.json'), 'utf8')).url).toBe(
		receipt.url
	);
	expect(await readFile(join(repository.directory(run.id), 'manifest.json'))).toEqual(frozen);
});
test('failed publication preserves a pending cleanup receipt without claiming success or changing proof', async () => {
	const { root, repository, run } = await publicationFixture();
	roots.push(root);
	const { store } = storage();
	await expect(
		new ReportPublishService(
			repository,
			store,
			async () => 'https://abc.project-report-shares.pages.dev',
			async () => {
				throw new Error('digest differs');
			}
		).publish(run.id)
	).rejects.toThrow('digest differs');
	const pending = JSON.parse(await readFile(join(root, 'publications', run.id + '.json'), 'utf8'));
	expect(pending).toMatchObject({
		run: run.id,
		state: 'pending',
		url: 'https://abc.project-report-shares.pages.dev'
	});
	expect((await repository.get(run.id)).status).toBe('failed');
});
