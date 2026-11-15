import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi, expect } from 'vitest';
import { CommitTreeAdapter } from '../../src/adapters/git-source-history/CommitTreeAdapter';
import { UnitRegistryRepository } from '../../src/repositories/verification-evidence/UnitRegistryRepository';
import { VideoCaptureService } from '../../src/services/verification-evidence/VideoCaptureService';
import { VideoArchiveService } from '../../src/services/verification-evidence/VideoArchiveService';
import { captureNativeFixture } from './videoCaptureNative';
import type { TemporaryRepo } from './temporary.types';
import type {
	VideoCaptureOptions,
	VideoCaptureResult
} from '../../src/services/verification-evidence/VideoCaptureService.types';
import type { VideoReferenceCandidate } from '../../src/services/verification-evidence/VideoReferenceService.types';

export const captureDeclaration = {
	schemaVersion: 1,
	viewports: [{ id: 'desktop', width: 160, height: 120 }],
	clips: ['first', 'second'].map((id) => ({
		id,
		unit: 'component.player',
		state: 'done',
		viewports: ['desktop'],
		inputs: ['src/player.ts'],
		script: { path: `test/${id}.ts`, export: 'record' },
		fixture: `test/${id}.json`,
		entry: 'ready',
		exit: 'done',
		states: ['ready', 'done'],
		edges: ['finish'],
		durationSeconds: 3
	})),
	graphs: [],
	playlists: [{ id: 'all', clips: ['first', 'second'] }]
};

/** Real archive media, with injected browser/native boundaries so selection is deterministic. */
export async function videoCaptureFixture({ root, git }: TemporaryRepo) {
	const commit = initializeCaptureRepo(root, git);
	const registry = await new UnitRegistryRepository(root).read(
		await CommitTreeAdapter.open(root, git('rev-parse', 'HEAD'))
	);
	expect(registry.errors).toEqual([]);
	const archive = new VideoArchiveService(root),
		native = captureNativeFixture(root);
	const proposals: VideoReferenceCandidate[] = [];
	const references = captureReferences(archive, proposals);
	const service = new VideoCaptureService(root, { references, archive, native: native.factory });
	let runs = 0;
	const options = (): VideoCaptureOptions => ({
		snapshot: root,
		source: { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') },
		buildId: 'b'.repeat(64),
		declaration: captureDeclaration,
		evidence: 'motion',
		directory: join(root, `.cache/captures-${runs++}`),
		env: { HARNESS_VIDEO_RECORD_TASK: 'video-build-20261115' },
		recordingAuthorization: { task: 'video-build-20261115' },
		browserFactory: native.browserFactory,
		loadScript: native.loadScript
	});
	const publish = (result: VideoCaptureResult) => {
		for (const capture of result.captures.filter((c) => !c.videoReference?.record))
			proposals.unshift({
				capture: {
					...capture,
					path: `evidence/${result.source.commit}/pilot/${capture.path}`,
					videoReference: {
						...capture.videoReference!,
						record: 'a'.repeat(64),
						revision: result.source.commit
					}
				},
				batches: [result.videoBatches.find((p) => p.batch === capture.videoReference!.batch)!],
				parent: { record: 'a'.repeat(64), revision: result.source.commit }
			});
	};
	return {
		root,
		git,
		commit,
		service,
		options,
		publish,
		proposals,
		references,
		native,
		archive,
		registry
	};
}

function initializeCaptureRepo(root: string, git: TemporaryRepo['git']) {
	for (const path of ['src', 'test', 'specification/units'])
		mkdirSync(join(root, path), { recursive: true });
	writeFileSync(join(root, '.gitignore'), '.cache/\n');
	writeFileSync(
		join(root, 'src/player.ts'),
		'// @harness-uid u_abcdefghij\nexport const player = 1;'
	);
	writeFileSync(join(root, 'src/unrelated.ts'), 'export const unrelated = 1;');
	for (const id of ['first', 'second']) {
		writeFileSync(join(root, `test/${id}.ts`), 'export function record() {}');
		writeFileSync(join(root, `test/${id}.json`), '{}');
	}
	writeFileSync(
		join(root, 'specification/units/component.player.json'),
		JSON.stringify({
			schemaVersion: 1,
			id: 'component.player',
			uid: 'u_abcdefghij',
			kind: 'component',
			title: 'Player',
			responsibility: 'Owns the disposable native capture fixture.',
			responsibilityOrigin: 'declared',
			status: 'active',
			owns: { source: ['src/player.ts'], symbols: ['player'] },
			contract: {
				origin: 'declared',
				inputs: [],
				outputs: [],
				errors: [],
				errorStatus: 'declared',
				operations: [],
				initialization: []
			},
			dependencies: [],
			runtime: {
				kind: 'module',
				entry: 'src/player.ts',
				targets: [{ kind: 'module', entry: 'src/player.ts' }]
			},
			scenarios: [],
			budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
		})
	);
	const commit = () => {
		git('add', '.');
		git('commit', '-qm', 'feat: update capture fixture');
	};
	commit();
	return commit;
}

function captureReferences(archive: VideoArchiveService, proposals: VideoReferenceCandidate[]) {
	return {
		candidates: vi.fn(async (slot: { clipId: string; inputHash: string }) =>
			proposals.filter(
				(row) =>
					row.capture.video!.clipId === slot.clipId &&
					row.capture.video!.inputHash === slot.inputHash
			)
		),
		resolve: vi.fn(
			async (input: {
				capture: VideoReferenceCandidate['capture'];
				batches: VideoReferenceCandidate['batches'] | VideoCaptureResult['videoBatches'];
			}) => {
				const c = input.capture,
					v = c.video!;
				const read = await archive.readClip(
					input.batches.find((p) => p.batch === c.videoReference!.batch)!,
					{
						unit: v.unit,
						unitUid: 'u_abcdefghij',
						clipId: v.clipId,
						state: c.state,
						viewport: c.viewport!,
						profile: 'normal',
						inputHash: v.inputHash
					}
				);
				return {
					...read,
					origin: { ...read.clip.original, record: c.videoReference?.record },
					inputHash: v.inputHash
				};
			}
		)
	};
}
