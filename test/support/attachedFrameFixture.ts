import { spawnSync } from 'node:child_process';
import { verificationSample } from './verificationSample';
import { hash } from './frameFlagFixture';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';
import { evidenceManifest } from '../../src/services/verification-evidence/evidence-attach-service/evidenceManifest';
import { lfsPointer } from '../../src/utils/verification-evidence/lfsPointer';
import { EvidenceBranchRepository } from '../../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { HistoryNoteRepository } from '../../src/repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import { LfsAdapter } from '../../src/adapters/git-source-history/LfsAdapter';
import { scopeFailure } from '../../src/workflows/verification-evidence/run-verify/verification-service/entityScope';
import type { FrameClipReference } from '../../src/services/verification-evidence/FrameFlagService.types';
import type {
	Capture,
	VerificationRecord
} from '../../src/core/verification-evidence/verificationTypes';

import type { AttachedFrameOptions } from './attachedFrameFixture.types';

/** Real sealed evidence, LFS objects and source note; no injected clip-reader shortcut. */
export async function attachedFrameFixture(
	options: AttachedFrameOptions
): Promise<FrameClipReference> {
	const { root, reference } = options;
	const { record, files } = frameRecordFixture(options);
	const pointer = await persistFrameRecord(root, record, files);
	await new HistoryNoteRepository(root).append(reference.revision, [
		{
			schemaVersion: 1,
			kind: 'verification',
			record: record.id,
			status: record.status,
			profile: record.profile.id,
			finishedAt: record.finishedAt,
			source: record.source,
			evidence: pointer
		}
	]);
	return { ...reference, record: record.id };
}

export function frameRecordFixture(options: AttachedFrameOptions) {
	const poster = fixturePoster(options.video),
		log = Buffer.from('passed');
	return {
		record: fixtureRecord(options, poster, log),
		files: new Map([
			['clip.mp4', options.video],
			['poster.png', poster],
			['test.log', log]
		])
	};
}

function fixturePoster(video: Buffer): Buffer {
	return spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-threads',
			'1',
			'-i',
			'pipe:0',
			'-frames:v',
			'1',
			'-threads',
			'1',
			'-f',
			'image2pipe',
			'-c:v',
			'png',
			'pipe:1'
		],
		{ input: video, timeout: 10_000, maxBuffer: 1_000_000 }
	).stdout;
}

function fixtureFailures({ standing, reference }: AttachedFrameOptions): string[] {
	if (standing === 'full') return [];
	if (standing === 'failed') return ['Actual failing check'];
	return [scopeFailure(standing === 'wrong-owner' ? 'component.other' : reference.unit)];
}

function fixtureRecord(
	options: AttachedFrameOptions,
	poster: Buffer,
	log: Buffer
): VerificationRecord {
	const { git, reference, standing } = options;
	const sample = verificationSample();
	delete (sample as Partial<VerificationRecord>).id;
	return sealRecord({
		...sample,
		source: { commit: reference.revision, tree: git('rev-parse', 'HEAD^{tree}'), base: null },
		status: standing === 'full' ? 'passed' : 'failed',
		failures: fixtureFailures(options),
		components: sample.components.map((component) => ({ ...component, unit: reference.unit })),
		measurements: [],
		tests: [
			{
				id: 'video',
				kind: 'unit',
				runner: 'command',
				target: 'fixture',
				status: 'passed',
				durationMs: 1,
				log: { path: 'test.log', sha256: hash(log), bytes: log.length }
			}
		],
		builds: [{ id: 'preview', directory: 'output', buildId: 'd'.repeat(64), files: 1 }],
		scenarios: [
			{
				id: 'player',
				status: 'passed',
				testedRevision: reference.revision,
				states: [
					{ id: 'moving', coverage: 'required', captures: [fixtureCapture(options, poster)] }
				]
			}
		]
	});
}

function fixtureCapture(
	{ reference, video, addressedFlags = [], capturedAt }: AttachedFrameOptions,
	poster: Buffer
): Capture {
	return {
		evidence: 'motion',
		kind: 'video',
		state: 'moving',
		viewport: reference.viewport,
		status: 'passed',
		path: 'clip.mp4',
		sha256: hash(video),
		bytes: video.length,
		mediaType: 'video/mp4',
		capturedAt: capturedAt ?? verificationSample().startedAt,
		durationSeconds: 1,
		server: { revision: reference.revision, buildId: 'd'.repeat(64) },
		video: {
			schemaVersion: 1,
			clipId: reference.clipId,
			unit: reference.unit,
			inputHash: 'c'.repeat(64),
			entry: 'moving',
			exit: 'moving',
			profile: 'normal',
			states: [{ id: 'moving', atSeconds: 0.2 }],
			edges: [],
			width: 160,
			height: 120,
			frameRate: 10,
			sourceFrameRate: 10,
			frameCount: 10,
			addressedFlags,
			poster: { file: 'poster.png', sha256: hash(poster), bytes: poster.length, timeSeconds: 0 }
		}
	};
}

async function persistFrameRecord(
	root: string,
	record: VerificationRecord,
	bytes: Map<string, Buffer>
) {
	const json = Buffer.from(JSON.stringify(record)),
		manifest = evidenceManifest(record, json);
	const text = JSON.stringify(manifest),
		lfs = new LfsAdapter(root);
	bytes.set('record.json', json);
	for (const file of manifest.files.filter((file) => file.storage === 'lfs'))
		await lfs.store(bytes.get(file.path)!);
	const path = `records/${record.source.commit}/${record.id}`;
	const added = await new EvidenceBranchRepository(root).add(
		path,
		[
			{ path: 'manifest.json', content: { bytes: text } },
			...manifest.files.map((file) => ({
				path: file.path,
				content: { bytes: file.storage === 'lfs' ? lfsPointer(file) : bytes.get(file.path)! }
			}))
		],
		'chore: retain attached frame fixture',
		'manifest.json'
	);
	return { commit: added.commit, path, manifest: hash(Buffer.from(text)) };
}
