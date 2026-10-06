import { afterEach, expect, test, vi } from 'vitest';
import { PutObjectCommand, GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
	R2EvidenceStoreAdapter,
	evidenceObjectKey
} from '../../src/adapters/R2EvidenceStoreAdapter';
const config = {
	accountId: 'fake',
	bucket: 'reports-only',
	accessKeyId: 'test',
	secretAccessKey: 'test'
};
afterEach(() => vi.unstubAllEnvs());
test('audio and image objects use the dedicated private evidence prefix and MIME', async () => {
	const send = vi
		.fn()
		.mockResolvedValue({ Body: { transformToByteArray: async () => Buffer.from('original') } });
	const store = new R2EvidenceStoreAdapter(config, { send } as unknown as S3Client);
	const file = 'a'.repeat(64) + '.wav';
	await store.put('report-1', file, Buffer.from('original'), 'audio/wav');
	expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
	expect(send.mock.calls[0][0].input).toMatchObject({
		Bucket: 'reports-only',
		Key: `report-evidence/runs/report-1/assets/${file}`,
		ContentType: 'audio/wav'
	});
	expect(await store.get('report-1', file)).toEqual(Buffer.from('original'));
	expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
	expect(() => evidenceObjectKey('../other', file)).toThrow();
	expect(() => evidenceObjectKey('report-1', 'unregistered.wav')).toThrow();
});
test('configured Cloudflare is the default, offline mode is explicit, and partial config fails', () => {
	vi.stubEnv('PROJECT_REPORTS_ASSET_STORAGE', '');
	vi.stubEnv('PROJECT_REPORTS_R2_ACCOUNT_ID', 'fake');
	vi.stubEnv('PROJECT_REPORTS_R2_BUCKET', 'reports-only');
	vi.stubEnv('PROJECT_REPORTS_R2_ACCESS_KEY_ID', 'test');
	vi.stubEnv('PROJECT_REPORTS_R2_SECRET_ACCESS_KEY', 'test');
	expect(R2EvidenceStoreAdapter.fromEnvironment()).toBeInstanceOf(R2EvidenceStoreAdapter);
	vi.stubEnv('PROJECT_REPORTS_ASSET_STORAGE', 'local');
	expect(R2EvidenceStoreAdapter.fromEnvironment()).toBeUndefined();
	vi.stubEnv('PROJECT_REPORTS_ASSET_STORAGE', '');
	vi.stubEnv('PROJECT_REPORTS_R2_SECRET_ACCESS_KEY', '');
	expect(() => R2EvidenceStoreAdapter.fromEnvironment()).toThrow(/partially configured/);
});
