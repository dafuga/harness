// @harness-uid u_akqk4uwm6b
import { randomUUID } from 'node:crypto';
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statfsSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { mediaFacts } from '../../../utils/verification-evidence/mediaFacts';
import { recordingFailure, recordingFile, recordingFlags, recordingHash } from './nativeFiles';
import type {
	NativeRecording,
	NativeRecordingLease,
	NativeRecordingReceipt
} from '../NativeVideoRecorderService.types';

export function recordingDirectory(
	root: string,
	slotKey: string,
	inputHash: string,
	addressedFlags: string[] = []
): string {
	if (!slotKey.trim() || slotKey.length > 500 || !/^[a-f0-9]{64}$/.test(inputHash))
		recordingFailure('native recording requires a slot identity and SHA-256 input hash');
	const flags = recordingFlags(addressedFlags);
	return join(
		root,
		recordingHash(slotKey),
		flags.length ? `${inputHash}-${recordingHash(JSON.stringify(flags))}` : inputHash
	);
}
export function cachedRecording(directory: string): NativeRecording | undefined {
	if (!existsSync(join(directory, 'result.json'))) return undefined;
	try {
		const stored = JSON.parse(
			recordingFile(join(directory, 'result.json'), 1_000_000).toString()
		) as NativeRecording;
		for (const kind of ['video', 'poster'] as const)
			stored[kind] = inspectCachedMedia(stored, kind, directory);
		if (
			stored.metadata.schemaVersion !== 1 ||
			stored.metadata.mapping.length !== stored.metadata.facts.frameCount
		)
			recordingFailure('recording cache mapping is incomplete');
		return { ...stored, directory };
	} catch (error) {
		return recordingFailure(
			`invalid native recording cache: ${error instanceof Error ? error.message : 'metadata unreadable'}`
		);
	}
}
export function leaseRecording(
	root: string,
	slotKey: string,
	inputHash: string,
	addressedFlags: string[] = []
): NativeRecordingLease {
	const finalDirectory = recordingDirectory(root, slotKey, inputHash, addressedFlags);
	mkdirSync(root, { recursive: true });
	const disk = statfsSync(root);
	if (disk.bavail * disk.bsize < 20 * 1024 ** 3)
		recordingFailure('native recording needs 20 GiB disk headroom');
	const slot = join(root, recordingHash(slotKey));
	mkdirSync(slot, { recursive: true });
	const lock = join(slot, 'capture.lock'),
		token = randomUUID();
	claimLock(lock, token);
	try {
		if (readdirSync(slot).filter((name) => name.startsWith('.partial-')).length >= 3)
			recordingFailure(
				'three failed raw recordings retained; inspect owned diagnostics before retrying'
			);
		const directory = join(slot, `.partial-${token}`);
		mkdirSync(join(directory, 'raw'), { recursive: true });
		writeFileSync(join(directory, 'owner.json'), JSON.stringify({ slotKey, inputHash, token }));
		return { directory, finalDirectory, release: () => releaseLock(lock, token) };
	} catch (error) {
		releaseLock(lock, token);
		throw error;
	}
}
function claimLock(path: string, token: string): void {
	if (existsSync(path))
		recordingFailure('native recording slot is locked; inspect its owner after a crash');
	try {
		const descriptor = openSync(path, 'wx');
		try {
			writeFileSync(descriptor, JSON.stringify({ pid: process.pid, token }));
		} finally {
			closeSync(descriptor);
		}
	} catch {
		recordingFailure('native recording slot is locked');
	}
}
function releaseLock(path: string, token: string): void {
	if (existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).token === token) rmSync(path);
}
export function finalizeRecording(
	lease: NativeRecordingLease,
	result: NativeRecording
): NativeRecording {
	writeFileSync(join(lease.directory, 'result.json'), JSON.stringify(result));
	renameSync(lease.directory, lease.finalDirectory);
	return cachedRecording(lease.finalDirectory)!;
}
export function acknowledgeRecording(
	result: NativeRecording,
	receipt: NativeRecordingReceipt
): void {
	const cached = cachedRecording(result.directory);
	if (
		!cached ||
		!receipt.record.trim() ||
		receipt.videoSha256 !== cached.video.sha256 ||
		receipt.posterSha256 !== cached.poster.sha256
	)
		recordingFailure('attachment receipt does not identify the finalized native recording');
	writeFileSync(join(result.directory, 'receipt.json'), JSON.stringify(receipt));
	rmSync(join(result.directory, 'raw'), { recursive: true, force: true });
}

function inspectCachedMedia(stored: NativeRecording, kind: 'video' | 'poster', directory: string) {
	const file = kind === 'video' ? 'clip.mp4' : 'poster.png';
	const bytes = recordingFile(join(directory, file), 8 * 1024 ** 2);
	if (recordingHash(bytes) !== stored[kind].sha256 || bytes.length !== stored[kind].bytes)
		recordingFailure('recording cache media hash or size changed');
	const facts = mediaFacts(bytes, kind === 'video' ? 'video/mp4' : 'image/png');
	if (
		'error' in facts ||
		(kind === 'video' && JSON.stringify(facts) !== JSON.stringify(stored.metadata.facts))
	)
		recordingFailure('recording cache media no longer satisfies admission');
	return { ...stored[kind], file, path: join(directory, file) };
}
