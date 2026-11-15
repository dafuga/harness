// @harness-uid u_zhz7hjx43x
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { LfsAdapter } from '../../../adapters/git-source-history/LfsAdapter';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { notesRef } from '../../../core/git-source-history/historyTypes';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { mediaFacts } from '../../../utils/verification-evidence/mediaFacts';
import { HistoryStatusService } from '../history-status-service/HistoryStatusService';
import { frameHash, owningFrameCapture } from './flagSchema';
import type { VerificationRecord } from '../../../core/verification-evidence/verificationTypes';
import type { AttachedRecord } from '../history-status-service/attached-record-service/AttachedRecordService.types';
import type {
	FrameClip,
	FrameClipReference,
	FrameFlag,
	FrameVideoFacts
} from '../FrameFlagService.types';

/** Follow only a verification note on the requested source, within the current evidence history. */
export async function defaultAttachedReader(
	reference: FrameClipReference,
	root: string = process.cwd()
): Promise<FrameClip> {
	const evidence = new EvidenceBranchRepository(root);
	const history = new HistoryStatusService(root, {
		evidence: (await evidence.tip()) ?? null,
		notes: (await evidence.tree.tip(notesRef)) ?? null
	});
	const loaded = await attachedFrameRecord(history, reference);
	const capture = owningFrameCapture(loaded.record!, reference);
	const bytes = loaded.files.get(capture.path);
	if (bytes?.length !== capture.bytes)
		throw new ExpectedCliError('Attached video bytes are missing or corrupt.');
	const video = capture.video!;
	return {
		...reference,
		bytes,
		sha256: capture.sha256,
		inputHash: video.inputHash,
		durationSeconds: capture.durationSeconds!,
		frameRate: video.frameRate,
		width: video.width,
		height: video.height,
		capturedAt: capture.capturedAt,
		addressedFlags: video.addressedFlags ?? []
	};
}

async function attachedFrameRecord(
	history: HistoryStatusService,
	reference: FrameClipReference
): Promise<AttachedRecord> {
	const note = (await history.all()).get(reference.revision);
	if (note?.problems.length) throw new ExpectedCliError(note.problems.join('; '));
	const lines = note?.entries.filter(
		(entry) => entry.kind === 'verification' && entry.record === reference.record
	);
	if (lines?.length !== 1 || lines[0].kind !== 'verification')
		throw new ExpectedCliError('Clip requires one matching attached verification record.');
	const line = lines[0],
		problems = await history.problems(line);
	if (problems.length)
		throw new ExpectedCliError(`Invalid attached evidence: ${problems.join('; ')}`);
	const loaded = await history.attached.load(line.evidence);
	if (!loaded.record || !frameRecordPassed(loaded.record, reference.unit))
		throw new ExpectedCliError('Clip record has not passed verification.');
	return loaded;
}

/** A successful focused record retains its explicit partial verdict. */
function frameRecordPassed(record: VerificationRecord, unit: string): boolean {
	const full = record.status === 'passed' && record.failures.length === 0;
	const scoped =
		record.failures.length === 1 &&
		record.failures[0] ===
			`Scoped to ${unit}: only its scenario states ran, so this record is partial and never a full pass.` &&
		record.tests.length > 0 &&
		record.tests.every((test) => test.status === 'passed') &&
		record.scenarios.length > 0 &&
		record.scenarios.every((scenario) => scenario.status === 'passed');
	return full || scoped;
}

export function inspectFrameClip(clip: FrameClip): FrameVideoFacts {
	const facts = mediaFacts(clip.bytes, 'video/mp4');
	if (!('kind' in facts) || facts.kind !== 'video')
		throw new ExpectedCliError('Attached video is corrupt or exceeds the bounded video limits.');
	const matches = [
		facts.width === clip.width,
		facts.height === clip.height,
		Math.abs(facts.durationSeconds - clip.durationSeconds) < 0.000001,
		Math.abs(facts.frameRate - clip.frameRate) < 0.000001
	];
	if (matches.includes(false))
		throw new ExpectedCliError('Actual video facts contradict attached metadata.');
	return facts;
}

export function extractFlagFrame(clip: FrameClip, frameNumber: number): Buffer {
	const child = spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-nostdin',
			'-xerror',
			'-max_alloc',
			'67108864',
			'-protocol_whitelist',
			'pipe',
			'-threads',
			'1',
			'-i',
			'pipe:0',
			'-map',
			'0:v:0',
			'-an',
			'-filter_threads',
			'1',
			'-vf',
			`select=eq(n\\,${frameNumber})`,
			'-frames:v',
			'1',
			'-threads',
			'1',
			'-c:v',
			'png',
			'-f',
			'image2pipe',
			'pipe:1'
		],
		{ input: clip.bytes, timeout: 20_000, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024 }
	);
	if (child.error || child.status !== 0)
		throw new ExpectedCliError('Exact video frame extraction failed or exceeded its bounds.');
	const facts = inspectFlagPng(child.stdout);
	if (facts.width !== clip.width || facts.height !== clip.height)
		throw new ExpectedCliError('Extracted frame dimensions contradict the original video.');
	return child.stdout;
}

export function inspectFlagPng(bytes: Buffer) {
	if (bytes.length < 24 || bytes.length > 8 * 1024 * 1024)
		throw new ExpectedCliError('Corrupt or oversized frame PNG.');
	const width = bytes.readUInt32BE(16),
		height = bytes.readUInt32BE(20);
	if (width > 1920 || height > 1920 || width * height > 2_073_600)
		throw new ExpectedCliError('Frame PNG dimensions exceed the video limits.');
	try {
		const facts = mediaFacts(bytes, 'image/png');
		if (!('kind' in facts) || facts.kind !== 'image') throw new Error('invalid PNG');
		return facts;
	} catch {
		throw new ExpectedCliError('Frame PNG is corrupt or cannot be decoded.');
	}
}

export async function materializeFlagFrame(
	root: string,
	flag: FrameFlag,
	directory: string
): Promise<string> {
	const bytes = await retainedFlagFrame(root, flag);
	const target = resolve(directory);
	await mkdir(target, { recursive: true });
	if (!(await lstat(target)).isDirectory())
		throw new ExpectedCliError('Feedback directory is not a regular directory.');
	const path = join(target, `${flag.id}.png`);
	await writeFrameInput(path, bytes);
	if (!(await lstat(path)).isFile() || frameHash(await readFile(path)) !== flag.frame.sha256)
		throw new ExpectedCliError('Materialized feedback frame hash/integrity failed.');
	return path;
}

/** Serve and attach only the exact retained, hash-verified PNG. */
export async function retainedFlagFrame(root: string, flag: FrameFlag): Promise<Buffer> {
	const bytes = await new LfsAdapter(root).read(flag.frame.sha256);
	if (bytes?.length !== flag.frame.bytes || frameHash(bytes) !== flag.frame.sha256)
		throw new ExpectedCliError('Retained frame hash/integrity is corrupt or unavailable.');
	inspectFlagPng(bytes);
	return bytes;
}

async function writeFrameInput(path: string, bytes: Buffer): Promise<void> {
	try {
		await writeFile(path, bytes, { flag: 'wx' });
	} catch (error) {
		if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
			throw new ExpectedCliError(
				'Feedback frame could not be written to the task input directory.'
			);
	}
}
