import { exampleInput, commit, tree } from './service.verification-evidence-video-capture.fixture';
import type { Summary } from './service.verification-evidence-video-capture.test.types';
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { VideoCaptureService } from '../../src/services/verification-evidence/VideoCaptureService';
import type { VideoCapturePlan, VideoCaptureScript, VideoCaptureScriptInput } from '../../src/services/verification-evidence/VideoCaptureService.types';
import {
	captureDigest,
	captureFile,
	captureText
} from '../../src/services/verification-evidence/video-capture-service/captureFiles';
import {
	admittedScript,
	captureCheckpoint,
	recordingAllowed
} from '../../src/services/verification-evidence/video-capture-service/captureScript';
import { captureReceiptStore } from '../../src/services/verification-evidence/video-capture-service/captureReceiptStore';

const unitId = 'service.verification-evidence-video-capture';
const signature = 'd'.repeat(64);

async function failureOf(run: () => unknown): Promise<Summary> {
	try {
		await run();
	} catch (error) {
		return { name: (error as Error).name, message: (error as Error).message };
	}
	throw new Error('Expected the call to reject');
}

function meta(state: string, symbol: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function scriptFixture(): { input: VideoCaptureScriptInput; plan: VideoCapturePlan } {
	const slot = { unit: 'unit.a', clipId: 'clip-a', viewport: 'desktop', inputHash: 'c'.repeat(64) };
	const clip = {
		id: 'clip-a',
		unit: 'unit.a',
		entry: 'start',
		exit: 'done',
		state: 'editing',
		states: ['start', 'editing', 'done'],
		edges: []
	};
	const input = {
		clip,
		slot,
		viewport: { id: 'desktop', width: 1280, height: 720 },
		pendingFlags: [{ id: 'flag-1', note: 'Check the focus ring' }]
	} as unknown as VideoCaptureScriptInput;
	const plan = {
		known: [
			{
				id: 'flag-1',
				unit: 'unit.a',
				clipId: 'clip-a',
				viewport: 'desktop',
				createdAt: '2026-11-16T00:00:00.000Z'
			}
		]
	} as unknown as VideoCapturePlan;
	return { input, plan };
}

test('Reports the video capture service identity', async () => {
	await withTempDir('video-capture-service-', (directory) => {
		const service = new VideoCaptureService(directory);
		expect(service.run()).toBe('video-capture');
		recordExampleCases(meta('reports-the-video-capture-service-identity', 'VideoCaptureService.run'), [
			{ name: 'service rooted in a temporary checkout', input: { root: 'temporary' }, output: service.run() }
		]);
	});
});

test('Reads bounded capture files and rejects a drifted digest', async () => {
	await withTempDir('video-capture-files-', async (directory) => {
		const path = join(directory, 'frame.bin');
		writeFileSync(path, 'capture-bytes');
		const sha256 = captureDigest('capture-bytes');
		const bytes = captureFile(path, sha256);
		const text = captureText(path, 64);
		const drift = await failureOf(() => captureFile(path, '0'.repeat(64)));
		expect(bytes.toString('utf8')).toBe('capture-bytes');
		expect(text).toBe('capture-bytes');
		expect(drift.message).toContain('hash changed');
		recordExampleCases(
			meta('reads-bounded-capture-files-and-rejects-a-drifted-digest', 'captureFile'),
			[
				{ name: 'digest of retained bytes', input: { bytes: 'capture-bytes' }, output: sha256 },
				{
					name: 'file read with its matching digest',
					input: { path: 'frame.bin', sha256 },
					output: bytes.toString('utf8')
				},
				{
					name: 'text read under the byte maximum',
					input: { path: 'frame.bin', maximum: 64 },
					output: text
				},
				{
					name: 'file read with a drifted digest is rejected',
					input: { path: 'frame.bin', sha256: '0'.repeat(64) },
					error: drift
				}
			]
		);
	});
});

test('Rejects video recording without the approved task', async () => {
	await withTempDir('video-capture-record-', async (directory) => {
		const input = exampleInput(directory);
		const error = await failureOf(() => recordingAllowed(input));
		expect(error.message).toContain('Video recording is not authorized');
		recordExampleCases(
			meta('rejects-video-recording-without-the-approved-task', 'recordingAllowed'),
			[
				{
					name: 'input without the approved recording task',
					input: { buildId: input.buildId, recordingAuthorization: null },
					error
				}
			]
		);
	});
});

test('Requires every pending reviewer flag to be addressed', async () => {
	const { input, plan } = scriptFixture();
	const unaddressed = await failureOf(() =>
		admittedScript({ addressedFlags: [] } as unknown as VideoCaptureScript, input, plan)
	);
	const accepted = { addressedFlags: ['flag-1'] } as unknown as VideoCaptureScript;
	expect(unaddressed.message).toContain('explicitly address every pending reviewer flag');
	expect(() => admittedScript(accepted, input, plan)).not.toThrow();
	recordExampleCases(meta('requires-every-pending-reviewer-flag-to-be-addressed', 'admittedScript'), [
		{
			name: 'script omits the pending flag',
			input: { pendingFlags: ['flag-1'], addressedFlags: [] },
			error: unaddressed
		},
		{
			name: 'script addresses the known pending flag',
			input: { pendingFlags: ['flag-1'], addressedFlags: ['flag-1'] },
			output: null
		}
	]);
});

test('Accepts observed checkpoints and rejects a drifted boundary', async () => {
	const session = {} as unknown as Parameters<typeof captureCheckpoint>[2];
	const script = { checkpoint: async () => signature } as unknown as VideoCaptureScript;
	const declared = {
		clip: {
			checkpoints: [
				{ viewport: 'desktop', entrySignature: signature, exitSignature: 'f'.repeat(64) }
			]
		},
		viewport: { id: 'desktop' }
	} as unknown as Pick<VideoCaptureScriptInput, 'clip' | 'viewport'>;
	const entry = await captureCheckpoint(script, declared, session, 'entry');
	const drift = await failureOf(() => captureCheckpoint(script, declared, session, 'exit'));
	expect(entry).toBe(signature);
	expect(drift.message).toContain('does not match the declared viewport boundary');
	recordExampleCases(
		meta('accepts-observed-checkpoints-and-rejects-a-drifted-boundary', 'captureCheckpoint'),
		[
			{ name: 'entry signature matches the declared entry', input: { boundary: 'entry' }, output: entry },
			{ name: 'observed signature drifts from the exit', input: { boundary: 'exit' }, error: drift }
		]
	);
});

test('Rejects a receipt store with a malformed source commit', async () => {
	await withTempDir('video-receipt-store-', async (directory) => {
		const path = join(directory, 'video-raw-receipts.json');
		writeFileSync(path, JSON.stringify({ source: { commit, tree }, videoBatches: [], raw: [] }));
		const stored = captureReceiptStore(directory);
		writeFileSync(
			path,
			JSON.stringify({ source: { commit: 'not-a-commit', tree }, videoBatches: [], raw: [] })
		);
		const error = await failureOf(() => captureReceiptStore(directory));
		expect(stored.source).toEqual({ commit, tree });
		expect(error.message).toContain('commit');
		recordExampleCases(
			meta('rejects-a-receipt-store-with-a-malformed-source-commit', 'captureReceiptStore'),
			[
				{ name: 'store with a valid source commit', input: { commit, tree }, output: stored },
				{
					name: 'store with a malformed source commit',
					input: { commit: 'not-a-commit', tree },
					error
				}
			]
		);
	});
});
