import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { NativeVideoRecorderService } from '../../src/services/verification-evidence/NativeVideoRecorderService';
import {
	leaseRecording,
	recordingDirectory
} from '../../src/services/verification-evidence/native-video-recorder-service/nativeCache';
import {
	recordingFile,
	recordingHash,
	recordingViewport
} from '../../src/services/verification-evidence/native-video-recorder-service/nativeFiles';

const UNIT = 'service.verification-evidence-native-video-recorder';
const SLOT = 'unit.example-clip.desktop.normal-motion';
const HASH = recordingHash('example source, contract and fixture inputs');

type Cases = Parameters<typeof recordExampleCases>[1];
type Outcome = { ok: true; value: unknown } | { ok: false; error: { name: string; message: string } };

function outcome(action: () => unknown): Outcome {
	try {
		return { ok: true, value: action() };
	} catch (error) {
		const failure = error as Error;
		return { ok: false, error: { name: failure.name, message: failure.message } };
	}
}

function viewport(width: number, height: number): Outcome {
	return outcome(() => {
		recordingViewport({ width, height });
		return 'accepted';
	});
}

function save(state: string, symbol: string, cases: Cases): void {
	recordExampleCases(
		{ unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Returns no recording for an empty native cache slot', async () => {
	await withTempDir('native-recorder-empty-', async (root) => {
		const service = new NativeVideoRecorderService(root);
		const result = await service.lookup(SLOT, HASH);
		expect(result).toBeUndefined();
		save('returns-no-recording-for-an-empty-native-cache-slot', 'lookup', [
			{
				name: 'empty slot lookup returns no recording',
				input: { slotKey: SLOT, inputHash: HASH },
				output: { recording: result ?? null }
			}
		]);
	});
});

test('Derives one slot directory for reordered addressed flags', async () => {
	await withTempDir('native-recorder-directory-', (root) => {
		const first = recordingDirectory(root, SLOT, HASH, ['flag-b', 'flag-a', 'flag-a']);
		const second = recordingDirectory(root, SLOT, HASH, ['flag-a', 'flag-b']);
		const plain = recordingDirectory(root, SLOT, HASH);
		expect(first).toBe(second);
		expect(first).not.toBe(plain);
		expect(plain).toBe(join(root, recordingHash(SLOT), HASH));
		save('derives-one-slot-directory-for-reordered-addressed-flags', 'recordingDirectory', [
			{
				name: 'reordered duplicate flags share one flagged directory',
				input: { slotKey: SLOT, inputHash: HASH, addressedFlags: ['flag-b', 'flag-a', 'flag-a'] },
				output: { directory: first.replace(root, '<root>') }
			},
			{
				name: 'sorted flags resolve to the same directory',
				input: { slotKey: SLOT, inputHash: HASH, addressedFlags: ['flag-a', 'flag-b'] },
				output: { directory: second.replace(root, '<root>') }
			},
			{
				name: 'unflagged variant uses the bare input hash directory',
				input: { slotKey: SLOT, inputHash: HASH },
				output: { directory: plain.replace(root, '<root>') }
			}
		]);
	});
});

test('Hashes exact example bytes with SHA-256', () => {
	const abc = recordingHash('abc');
	const empty = recordingHash('');
	expect(abc).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	expect(empty).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	save('hashes-exact-example-bytes-with-sha-256', 'recordingHash', [
		{ name: 'three ASCII bytes hash to the published vector', input: { bytes: 'abc' }, output: { sha256: abc } },
		{ name: 'empty text hashes to the empty-input digest', input: { bytes: '' }, output: { sha256: empty } }
	]);
});

test('Admits only fixed even viewports inside native bounds', () => {
	const accepted = viewport(1280, 720);
	const maximum = viewport(1920, 1080);
	const odd = viewport(1281, 720);
	expect(accepted.ok).toBe(true);
	expect(maximum.ok).toBe(true);
	expect(odd.ok).toBe(false);
	save('admits-only-fixed-even-viewports-inside-native-bounds', 'recordingViewport', [
		{ name: 'HD viewport is admitted', input: { width: 1280, height: 720 }, output: accepted },
		{ name: 'full HD viewport at the total pixel bound is admitted', input: { width: 1920, height: 1080 }, output: maximum },
		{ name: 'odd width is refused', input: { width: 1281, height: 720 }, output: odd }
	]);
});

test('Refuses an empty recording file before reading it', async () => {
	await withTempDir('native-recorder-file-', (directory) => {
		const empty = join(directory, 'empty.bin');
		const small = join(directory, 'small.bin');
		writeFileSync(empty, '');
		writeFileSync(small, 'frame');
		const refused = outcome(() => recordingFile(empty, 16).toString());
		const oversized = outcome(() => recordingFile(small, 4).toString());
		const admitted = outcome(() => recordingFile(small, 16).toString());
		expect(refused.ok).toBe(false);
		expect(oversized.ok).toBe(false);
		expect(admitted).toEqual({ ok: true, value: 'frame' });
		save('refuses-an-empty-recording-file-before-reading-it', 'recordingFile', [
			{ name: 'empty file is refused before reading', input: { file: 'empty.bin', maximum: 16 }, output: refused },
			{ name: 'file larger than the maximum is refused', input: { file: 'small.bin', maximum: 4 }, output: oversized },
			{ name: 'file within the maximum is admitted', input: { file: 'small.bin', maximum: 16 }, output: admitted }
		]);
	});
});

test('Holds a recording slot lease against a second owner', async () => {
	await withTempDir('native-recorder-lease-', async (root) => {
		const lease = leaseRecording(root, SLOT, HASH);
		const second = outcome(() => leaseRecording(root, SLOT, HASH));
		lease.release();
		const reacquired = outcome(() => {
			leaseRecording(root, SLOT, HASH).release();
			return 'reacquired';
		});
		expect(lease.finalDirectory).toBe(recordingDirectory(root, SLOT, HASH));
		expect(second.ok).toBe(false);
		expect(reacquired).toEqual({ ok: true, value: 'reacquired' });
		save('holds-a-recording-slot-lease-against-a-second-owner', 'leaseRecording', [
			{
				name: 'first lease owns a partial directory under the final slot',
				input: { slotKey: SLOT, inputHash: HASH },
				output: {
					finalDirectory: lease.finalDirectory.replace(root, '<root>'),
					partial: lease.directory.includes('.partial-')
				}
			},
			{ name: 'second owner of a held slot is refused', input: { slotKey: SLOT, inputHash: HASH }, output: second },
			{ name: 'slot is leasable again after release', input: { slotKey: SLOT, inputHash: HASH }, output: reacquired }
		]);
	});
});
