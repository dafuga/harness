import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	screenshotObjectPrefix,
	r2ScreenshotConfig,
	r2ObjectKey,
	R2ScreenshotStoreAdapter
} from '../../src/adapters/reports-media/R2ScreenshotStoreAdapter';
import { R2ScreenshotStoreError } from '../../src/adapters/reports-media/R2ScreenshotStoreAdapter.types';
import type { R2ScreenshotStoreAdapterConfig } from '../../src/adapters/reports-media/R2ScreenshotStoreAdapter.types';

const file = `${'0'.repeat(64)}.png`;
const config: R2ScreenshotStoreAdapterConfig = {
	accountId: 'r2-account',
	bucket: 'project-reports',
	accessKeyId: 'access-key-id',
	secretAccessKey: 'secret-access-key',
	endpoint: 'http://127.0.0.1:9000'
};

function tempDirectory(prefix: string) {
	return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

function clean(directory: string) {
	rmSync(directory, { recursive: true, force: true });
}

test('resolves process settings ahead of local R2 values', () => {
	const directory = tempDirectory('r2-config-examples');
	try {
		const localFile = join(directory, '.env');
		writeFileSync(
			localFile,
			'PROJECT_REPORTS_R2_ACCOUNT_ID=local-account\nPROJECT_REPORTS_R2_BUCKET="local-bucket"\nPROJECT_REPORTS_R2_ACCESS_KEY_ID=local-access\nPROJECT_REPORTS_R2_SECRET_ACCESS_KEY=local-secret\n'
		);
		const source = {
			PROJECT_REPORTS_R2_ACCOUNT_ID: 'r2-account',
			PROJECT_REPORTS_R2_BUCKET: 'project-reports',
			PROJECT_REPORTS_R2_ACCESS_KEY_ID: 'access-key-id',
			PROJECT_REPORTS_R2_SECRET_ACCESS_KEY: 'secret-access-key',
			PROJECT_REPORTS_R2_ENDPOINT: 'http://127.0.0.1:9000'
		};
		const output = r2ScreenshotConfig(source, localFile);
		expect(output).toEqual({
			accountId: 'r2-account',
			bucket: 'project-reports',
			accessKeyId: 'access-key-id',
			secretAccessKey: 'secret-access-key',
			endpoint: 'http://127.0.0.1:9000'
		});
		recordExampleCases(
			{
				unitId: 'reports.adapter.r2-screenshot-store',
				symbol: 'r2ScreenshotConfig',
				state: 'resolves-process-settings-ahead-of-local-r2-values',
				evidence: 'examples-cases',
				file: 'resolves-process-settings-ahead-of-local-r2-values.json'
			},
			[
				{
					name: 'process settings supply the resolved R2 configuration',
					input: { source, localFile },
					output
				}
			]
		);
	} finally {
		clean(directory);
	}
});

test('builds a validated screenshot object key', () => {
	const output = r2ObjectKey('report-123', file);
	expect(output).toBe(`${screenshotObjectPrefix}runs/report-123/assets/${file}`);
	let error: unknown;
	try {
		r2ObjectKey('report-123', 'Screenshot.png');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(R2ScreenshotStoreError);
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-screenshot-store',
			symbol: 'r2ObjectKey',
			state: 'builds-a-validated-screenshot-object-key',
			evidence: 'examples-cases',
			file: 'builds-a-validated-screenshot-object-key.json'
		},
		[
			{ name: 'valid report screenshot', input: { reportId: 'report-123', file }, output },
			{
				name: 'uppercase filename is rejected',
				input: { reportId: 'report-123', file: 'Screenshot.png' },
				error: 'Invalid R2 image name'
			}
		]
	);
});

test('Throws R2ScreenshotStoreError for an invalid filename', () => {
	let error: unknown;
	try {
		r2ObjectKey('report-123', 'Screenshot.png');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(R2ScreenshotStoreError);
	expect(error).toMatchObject({ message: 'Invalid R2 image name' });
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-screenshot-store',
			symbol: 'r2ObjectKey',
			state: 'throws-r2screenshotstoreerror-for-an-invalid-filename',
			evidence: 'examples-cases',
			file: 'throws-r2screenshotstoreerror-for-an-invalid-filename.json'
		},
		[
			{
				name: 'uppercase filename is rejected',
				input: { reportId: 'report-123', file: 'Screenshot.png' },
				error: { name: 'R2ScreenshotStoreError', message: 'Invalid R2 image name' }
			}
		]
	);
});

test('stores and retrieves screenshot bytes through the client', async () => {
	const directory = tempDirectory('r2-store-examples');
	try {
		const objectPath = join(directory, 'object.json');
		const client = {
			async send(command: { input: Record<string, unknown> }) {
				if ('Body' in command.input) {
					writeFileSync(
						objectPath,
						JSON.stringify({
							bucket: command.input.Bucket,
							key: command.input.Key,
							body: Buffer.from(command.input.Body as Buffer).toString('base64'),
							contentType: command.input.ContentType
						})
					);
					return {};
				}
				const stored = JSON.parse(readFileSync(objectPath, 'utf8')) as { body: string };
				return {
					Body: {
						async transformToByteArray() {
							return Buffer.from(stored.body, 'base64');
						}
					}
				};
			}
		};
		const adapter = new R2ScreenshotStoreAdapter(config, client as never);
		const bytes = Buffer.from('example screenshot bytes');
		const putOutput = await adapter.put('report-123', file, bytes, 'image/png');
		const getOutput = await adapter.get('report-123', file);
		expect(putOutput).toBeUndefined();
		expect(getOutput).toEqual(bytes);
		const stored = JSON.parse(readFileSync(objectPath, 'utf8')) as Record<string, unknown>;
		recordExampleCases(
			{
				unitId: 'reports.adapter.r2-screenshot-store',
				symbol: 'R2ScreenshotStoreAdapter.put and get',
				state: 'stores-and-retrieves-screenshot-bytes-through-the-client',
				evidence: 'examples-cases',
				file: 'stores-and-retrieves-screenshot-bytes-through-the-client.json'
			},
			[
				{
					name: 'put sends screenshot fields to the bucket',
					input: {
						reportId: 'report-123',
						file,
						bytes: bytes.toString('base64'),
						mime: 'image/png'
					},
					output: { ...stored, putResult: null }
				},
				{
					name: 'get returns the stored screenshot bytes',
					input: { reportId: 'report-123', file },
					output: { bytes: getOutput.toString('base64') }
				}
			]
		);
	} finally {
		clean(directory);
	}
}, 20_000);
