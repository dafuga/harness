import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { evidenceObjectKey, replayObjectKey, R2EvidenceStoreAdapter } from '../../src/adapters/reports-media/R2EvidenceStoreAdapter';
import { R2EvidenceStoreError } from '../../src/adapters/reports-media/R2EvidenceStoreAdapter.types';

type Client = NonNullable<ConstructorParameters<typeof R2EvidenceStoreAdapter>[1]>;
type Sent = { key: string; type: string | undefined };
type FakeCommand = { input: { Key: string; Body?: Buffer; ContentType?: string } };

const REPORT = '5b0e7c3a-9f2d-4c8e-8a1b-6d3f2e1c0b9a';
const PNG = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.png';
const WEBP = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.webp';
const MP4 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad.mp4';
const CONFIG = {
	accountId: 'local-account',
	bucket: 'local-bucket',
	accessKeyId: 'local-access',
	secretAccessKey: 'local-secret'
};

// A fake S3 client that stores objects as files under the temporary root.
function fakeS3(root: string, sent: Sent[]): Client {
	const send = ({ input }: FakeCommand) => {
		sent.push({ key: input.Key, type: input.ContentType });
		const path = join(root, input.Key);
		if (input.Body) {
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, input.Body);
			return Promise.resolve({});
		}
		const body = { transformToByteArray: () => Promise.resolve(new Uint8Array(readFileSync(path))) };
		return Promise.resolve({ Body: body });
	};
	return { send } as unknown as Client;
}

async function withStore(run: (root: string) => Promise<void>) {
	const root = mkdtempSync(join(tmpdir(), 'r2-evidence-examples-'));
	try {
		await run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

function failure(error: unknown): string {
	const kind = error instanceof R2EvidenceStoreError ? 'R2EvidenceStoreError' : 'Error';
	return `${kind}: ${error instanceof Error ? error.message : String(error)}`;
}

function syncFailure(run: () => unknown): string {
	try {
		run();
		return 'no error';
	} catch (error) {
		return failure(error);
	}
}

async function asyncFailure(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
		return 'no error';
	} catch (error) {
		return failure(error);
	}
}

test('Builds evidence object keys under the run folder', () => {
	const png = evidenceObjectKey(REPORT, PNG);
	const webp = evidenceObjectKey(REPORT, WEBP);
	expect(png).toBe(`report-evidence/runs/${REPORT}/assets/${PNG}`);
	expect(webp).toBe(`report-evidence/runs/${REPORT}/assets/${WEBP}`);
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-evidence-store',
			symbol: 'evidenceObjectKey',
			state: 'builds-evidence-object-keys-under-the-run-folder',
			evidence: 'examples-cases',
			file: 'builds-evidence-object-keys-under-the-run-folder.json'
		},
		[
			{ name: 'png evidence key', input: { reportId: REPORT, file: PNG }, output: png },
			{ name: 'webp evidence key', input: { reportId: REPORT, file: WEBP }, output: webp }
		]
	);
});

test('Rejects evidence names and report IDs that fail their checks', () => {
	const badFile = syncFailure(() => evidenceObjectKey(REPORT, 'bad.png'));
	const badReport = syncFailure(() => evidenceObjectKey('../escape', PNG));
	expect(badFile).toBe('R2EvidenceStoreError: Invalid R2 evidence name');
	expect(badReport).toBe('Error: Invalid report or asset ID');
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-evidence-store',
			symbol: 'evidenceObjectKey',
			state: 'rejects-evidence-names-and-report-ids-that-fail-their-checks',
			evidence: 'examples-cases',
			file: 'rejects-evidence-names-and-report-ids-that-fail-their-checks.json'
		},
		[
			{
				name: 'file without a hex digest is rejected',
				input: { reportId: REPORT, file: 'bad.png' },
				error: badFile
			},
			{
				name: 'report ID with path segments is rejected',
				input: { reportId: '../escape', file: PNG },
				error: badReport
			}
		]
	);
});

test('Builds replay object keys and rejects non-mp4 replay names', () => {
	const key = replayObjectKey(REPORT, MP4);
	const error = syncFailure(() => replayObjectKey(REPORT, PNG));
	expect(key).toBe(`report-evidence/runs/${REPORT}/replays/${MP4}`);
	expect(error).toBe('R2EvidenceStoreError: Invalid R2 replay name');
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-evidence-store',
			symbol: 'replayObjectKey',
			state: 'builds-replay-object-keys-and-rejects-non-mp4-replay-names',
			evidence: 'examples-cases',
			file: 'builds-replay-object-keys-and-rejects-non-mp4-replay-names.json'
		},
		[
			{ name: 'mp4 replay key', input: { reportId: REPORT, file: MP4 }, output: key },
			{ name: 'png name is not a replay', input: { reportId: REPORT, file: PNG }, error }
		]
	);
});

test('Stores evidence bytes under the evidence key with the given type', async () => {
	await withStore(async (root) => {
		const sent: Sent[] = [];
		const adapter = new R2EvidenceStoreAdapter(CONFIG, fakeS3(root, sent));
		await adapter.put(REPORT, PNG, Buffer.from('png-bytes'), 'image/png');
		const read = await adapter.get(REPORT, PNG);
		expect(sent).toEqual([
			{ key: `report-evidence/runs/${REPORT}/assets/${PNG}`, type: 'image/png' },
			{ key: `report-evidence/runs/${REPORT}/assets/${PNG}`, type: undefined }
		]);
		expect(read.toString()).toBe('png-bytes');
		recordExampleCases(
			{
				unitId: 'reports.adapter.r2-evidence-store',
				symbol: 'R2EvidenceStoreAdapter.put',
				state: 'stores-evidence-bytes-under-the-evidence-key-with-the-given',
				evidence: 'examples-cases',
				file: 'stores-evidence-bytes-under-the-evidence-key-with-the-given.json'
			},
			[
				{
					name: 'png is written with image/png and read back unchanged',
					input: { reportId: REPORT, file: PNG, mime: 'image/png', bytes: 'png-bytes' },
					output: { calls: sent, readBack: read.toString() }
				}
			]
		);
	});
}, 20_000);

test('Stores and reads replay bytes as video/mp4', async () => {
	await withStore(async (root) => {
		const sent: Sent[] = [];
		const adapter = new R2EvidenceStoreAdapter(CONFIG, fakeS3(root, sent));
		await adapter.putReplay(REPORT, MP4, Buffer.from('mp4-bytes'));
		const read = await adapter.getReplay(REPORT, MP4);
		expect(sent[0]?.type).toBe('video/mp4');
		expect(read.toString()).toBe('mp4-bytes');
		recordExampleCases(
			{
				unitId: 'reports.adapter.r2-evidence-store',
				symbol: 'R2EvidenceStoreAdapter.putReplay',
				state: 'stores-and-reads-replay-bytes-as-video-mp4',
				evidence: 'examples-cases',
				file: 'stores-and-reads-replay-bytes-as-video-mp4.json'
			},
			[
				{
					name: 'replay is written as video/mp4 and read back unchanged',
					input: { reportId: REPORT, file: MP4, bytes: 'mp4-bytes' },
					output: { calls: sent, readBack: read.toString() }
				}
			]
		);
	});
}, 20_000);

test('Fails reads with no body and skips S3 for bad names', async () => {
	await withStore(async (root) => {
		const sent: Sent[] = [];
		const adapter = new R2EvidenceStoreAdapter(CONFIG, fakeS3(root, sent));
		const emptyS3 = new R2EvidenceStoreAdapter(CONFIG, {
			send: () => Promise.resolve({})
		} as unknown as Client);
		const readError = await asyncFailure(emptyS3.get(REPORT, PNG));
		const putError = await asyncFailure(adapter.put(REPORT, 'bad.png', Buffer.from('x'), 'image/png'));
		expect(readError).toBe('R2EvidenceStoreError: R2 evidence has no body');
		expect(putError).toBe('R2EvidenceStoreError: Invalid R2 evidence name');
		expect(sent).toEqual([]);
		recordExampleCases(
			{
				unitId: 'reports.adapter.r2-evidence-store',
				symbol: 'R2EvidenceStoreAdapter.get',
				state: 'fails-reads-with-no-body-and-skips-s3-for-bad-names',
				evidence: 'examples-cases',
				file: 'fails-reads-with-no-body-and-skips-s3-for-bad-names.json'
			},
			[
				{
					name: 'get whose response has no Body rejects',
					input: { reportId: REPORT, file: PNG },
					error: readError
				},
				{
					name: 'put with a bad name rejects before any S3 call',
					input: { reportId: REPORT, file: 'bad.png' },
					error: putError
				}
			]
		);
	});
}, 20_000);
