import type { Client } from './workflow.networking-security-run-api-api-screenshot.test.types';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'vitest';
import { apiScreenshot } from '../../src/workflows/networking-security/run-api/apiScreenshot';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'workflow.networking-security-run-api-api-screenshot';
const entityId = 'reports.component.regression-proof';
const commit = '7c2e1d9f04a6b83e5d1c7f29a0e4b6d8c3f19a57';
const bytes = Buffer.from('fake-png-bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');

function evidenceFor() {
	const capture = {
		kind: 'screenshot',
		status: 'passed',
		viewport: 'desktop',
		evidence: 'evidence-1',
		sha256,
		media: 'artifact',
		capturedAt: '2026-11-12T14:03:27.511Z'
	};
	return {
		scope: {},
		identity: { notesRevision: null, evidenceRevision: 'evidence-rev-1' },
		behavior: {},
		evidence: {
			before: null,
			after: {
				commit,
				detail: null,
				record: { id: 'record-1', status: 'passed' },
				coverage: [],
				gap: null,
				captures: [
					{
						scenario: 'runtime-evidence-ui',
						state: 'current',
						capture,
						standing: 'fresh',
						usable: true,
						current: true,
						inheritedFrom: null
					}
				]
			}
		}
	};
}

function fakeClient(artifact: { bytes: Buffer; mediaType: string }): Client {
	const client = {
		snapshot: async () => ({ revision: { branch: 'main', commit } }),
		read: async (kind: string) => (kind === 'evidence' ? { data: evidenceFor() } : artifact)
	};
	return client as unknown as Client;
}

async function rejectionOf(work: Promise<unknown>): Promise<unknown> {
	try {
		await work;
	} catch (error) {
		return error;
	}
	return undefined;
}

test('Saves the verified current screenshot with its provenance', async () => {
	await withTempDir('api-screenshot-saves-', async (directory) => {
		const output = join(directory, 'regression-proof-current.png');
		const result = await apiScreenshot(fakeClient({ bytes, mediaType: 'image/png' }), entityId, {
			output
		});
		expect(result.path).toBe(output);
		expect(readFileSync(output).equals(bytes)).toBe(true);
		expect(result.sha256).toBe(sha256);
		expect(result.verification.usable).toBe(true);
		expect(result.verification.status).toBe('passed');
		recordExampleCases(
			{
				unitId,
				symbol: 'apiScreenshot',
				state: 'saves-the-verified-current-screenshot-with-its-provenance',
				evidence: 'examples-cases',
				file: 'saves-the-verified-current-screenshot-with-its-provenance.json'
			},
			[
				{
					name: 'current after-side capture is saved and hash-checked',
					input: { entityId, options: { output: basename(output) } },
					output: {
						entityId: result.entityId,
						commit: result.commit,
						scenario: result.scenario,
						state: result.state,
						viewport: result.viewport,
						sha256: result.sha256,
						mediaType: result.mediaType,
						inheritedFrom: result.inheritedFrom,
						verification: result.verification
					}
				}
			]
		);
	});
});

test('Rejects a tampered screenshot whose hash differs', async () => {
	await withTempDir('api-screenshot-tampered-', async (directory) => {
		const output = join(directory, 'regression-proof-tampered.png');
		const artifact = { bytes: Buffer.from('tampered'), mediaType: 'image/png' };
		const error = await rejectionOf(apiScreenshot(fakeClient(artifact), entityId, { output }));
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Screenshot SHA-256 integrity check failed.');
		expect(existsSync(output)).toBe(false);
		recordExampleCases(
			{
				unitId,
				symbol: 'apiScreenshot',
				state: 'rejects-a-tampered-screenshot-whose-hash-differs',
				evidence: 'examples-cases',
				file: 'rejects-a-tampered-screenshot-whose-hash-differs.json'
			},
			[
				{
					name: 'artifact bytes that differ from the recorded sha256 are refused before writing',
					input: { entityId, options: { output: basename(output) } },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});

test('Refuses to overwrite an existing output file', async () => {
	await withTempDir('api-screenshot-exists-', async (directory) => {
		const output = join(directory, 'regression-proof-current.png');
		writeFileSync(output, 'previous');
		const artifact = { bytes, mediaType: 'image/png' };
		const error = await rejectionOf(apiScreenshot(fakeClient(artifact), entityId, { output }));
		expect((error as { code?: string }).code).toBe('EEXIST');
		expect(readFileSync(output, 'utf8')).toBe('previous');
		recordExampleCases(
			{
				unitId,
				symbol: 'apiScreenshot',
				state: 'refuses-to-overwrite-an-existing-output-file',
				evidence: 'examples-cases',
				file: 'refuses-to-overwrite-an-existing-output-file.json'
			},
			[
				{
					name: 'existing output path rejects with EEXIST and keeps its previous bytes',
					input: { entityId, options: { output: basename(output) } },
					error: {
						name: (error as Error).name,
						code: (error as { code?: string }).code
					}
				}
			]
		);
	});
});
