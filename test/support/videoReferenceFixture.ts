import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { videoArchiveFixture } from './videoArchiveFixture';
import { videoReferenceOwner } from './videoReferenceOwner';
import { verificationSample } from './verificationSample';
import { hash } from './frameFlagFixture';
import { VideoArchiveService } from '../../src/services/verification-evidence/VideoArchiveService';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';
import type {
	Capture,
	VerificationRecord
} from '../../src/core/verification-evidence/verificationTypes';

/** Canonical admitted synthetic media, backed by a real archive and parent cache without media copies. */
export async function videoReferenceFixture(root: string, git: (...args: string[]) => string) {
	const input = await videoArchiveFixture(root, git);
	const owner = await videoReferenceOwner(root, git);
	input.original.revision = owner.commit;
	input.original.tree = owner.tree;
	const pointers = await new VideoArchiveService(root).write([input]);
	const capture: Capture = {
		evidence: 'motion',
		kind: 'video',
		state: input.slot.state,
		viewport: input.slot.viewport,
		status: 'passed',
		path: 'clips/play/clip.mp4',
		sha256: input.sha256,
		bytes: input.videoBytes.length,
		mediaType: 'video/mp4',
		capturedAt: input.original.capturedAt,
		durationSeconds: input.durationSeconds,
		server: { revision: input.original.revision, buildId: input.original.buildId },
		video: input.video,
		videoReference: { batch: pointers[0].batch }
	};
	const source = { commit: input.original.revision, tree: input.original.tree, base: null };
	const record = referenceRecord({ source, capture, pointers, components: owner.components });
	return { input, pointers, capture, record, stored: await saveVideoParent(root, record) };
}

export function referenceRecord(input: {
	source: VerificationRecord['source'];
	capture: Capture;
	pointers: NonNullable<VerificationRecord['videoBatches']>;
	failures?: string[];
	components?: VerificationRecord['components'];
	startedAt?: string;
}): VerificationRecord {
	const { id, ...sample } = verificationSample();
	void id;
	const offset =
		parseInt(hash(Buffer.from((input.failures ?? []).join('|'))).slice(0, 4), 16) % 500;
	const startedAt =
		input.startedAt ?? new Date(Date.parse(input.capture.capturedAt) - 1000 + offset).toISOString();
	return sealRecord({
		...sample,
		startedAt,
		finishedAt: new Date(Date.parse(startedAt) + 5000).toISOString(),
		source: input.source,
		components: input.components ?? [],
		measurements: [],
		status: input.failures?.length ? 'failed' : 'passed',
		failures: input.failures ?? [],
		videoBatches: input.pointers,
		builds: [
			{ id: 'preview', directory: 'output', buildId: input.capture.server!.buildId, files: 1 }
		],
		tests: [
			{
				id: 'player:video',
				kind: 'unit',
				runner: 'command',
				target: 'synthetic-video-fixture',
				status: 'passed',
				durationMs: 1,
				log: { path: 'check.log', bytes: 6, sha256: hash(Buffer.from('passed')) }
			}
		],
		scenarios: [
			{
				id: 'player',
				status: 'passed',
				testedRevision: input.source.commit,
				videoCoverage: [
					{ graph: 'player', states: 1, edges: 0, clips: 1, complete: true, missing: [] }
				],
				states: [{ id: input.capture.state, coverage: 'required', captures: [input.capture] }]
			}
		]
	});
}

export async function saveVideoParent(root: string, record: VerificationRecord) {
	const store = new VerificationStoreRepository(root);
	const directory = store.directoryFor(record.source.commit, record.startedAt);
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'check.log'), 'passed');
	await store.save(record, directory);
	return { record, directory };
}

export async function reusedVideoParent(
	root: string,
	git: (...args: string[]) => string,
	original: VerificationRecord
) {
	await writeFile(join(root, 'README.md'), 'Unrelated parent revision');
	git('add', 'README.md');
	git('commit', '-qm', 'feat: unrelated parent source');
	const source = {
		commit: git('rev-parse', 'HEAD'),
		tree: git('rev-parse', 'HEAD^{tree}'),
		base: null
	};
	const capture = globalThis.structuredClone(original.scenarios[0].states[0].captures[0]);
	capture.videoReference = {
		...capture.videoReference!,
		record: original.id,
		revision: original.source.commit
	};
	const record = referenceRecord({
		source,
		capture,
		pointers: original.videoBatches!,
		components: original.components,
		startedAt: new Date(Date.parse(original.startedAt) + 10_000).toISOString()
	});
	return { capture, record, stored: await saveVideoParent(root, record) };
}
