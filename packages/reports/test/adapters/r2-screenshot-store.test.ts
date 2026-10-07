import { expect, test, vi } from 'vitest';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	R2ScreenshotStoreAdapter,
	r2ObjectKey,
	r2ScreenshotConfig
} from '../../src/adapters/R2ScreenshotStoreAdapter';

test('R2 adapter scopes writes to the configured private bucket and report', async () => {
	const send = vi.fn().mockResolvedValue({});
	const store = new R2ScreenshotStoreAdapter(
		{ accountId: 'fake', bucket: 'reports-only', accessKeyId: 'test', secretAccessKey: 'test' },
		{ send } as unknown as S3Client
	);
	const file = 'a'.repeat(64) + '.png';
	await store.put('report-1', file, Buffer.from('image'), 'image/png');
	const command = send.mock.calls[0][0] as PutObjectCommand;
	expect(command).toBeInstanceOf(PutObjectCommand);
	expect(command.input).toMatchObject({
		Bucket: 'reports-only',
		Key: `uploaded-screenshots/runs/report-1/assets/${file}`,
		ContentType: 'image/png'
	});
	expect(() => r2ObjectKey('../other', file)).toThrow();
	expect(() => r2ObjectKey('report-1', '../other.png')).toThrow();
});

test('local credential file enables the server, while explicit environment values take precedence', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'report-r2-env-'));
	try {
		const file = join(directory, '.env.local');
		await writeFile(
			file,
			'PROJECT_REPORTS_R2_ACCOUNT_ID=local-account\n' +
				'PROJECT_REPORTS_R2_BUCKET=local-bucket\n' +
				'PROJECT_REPORTS_R2_ACCESS_KEY_ID=local-access\n' +
				'PROJECT_REPORTS_R2_SECRET_ACCESS_KEY=local-secret\n'
		);
		expect(r2ScreenshotConfig({}, file)).toMatchObject({
			accountId: 'local-account',
			bucket: 'local-bucket',
			accessKeyId: 'local-access',
			secretAccessKey: 'local-secret'
		});
		expect(r2ScreenshotConfig({ PROJECT_REPORTS_R2_BUCKET: 'override' }, file).bucket).toBe(
			'override'
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
