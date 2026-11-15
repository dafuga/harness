import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { videoReferenceFixture } from './videoReferenceFixture';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import type { TemporaryRepo } from './temporary.types';
import type { Capture } from '../../src/core/verification-evidence/verificationTypes';
import type { VideoGatherContext } from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/gatherVideoReferences.types';

export async function gatherVideoReferenceFixture({ root, git }: TemporaryRepo) {
	const f = await videoReferenceFixture(root, git);
	await new EvidenceAttachService(root).attach(f.record.source.commit, f.stored);
	writeFileSync(join(root, 'README.md'), 'Unrelated requesting revision');
	git('add', 'README.md');
	git('commit', '-qm', 'feat: unrelated requesting revision');
	const capture = {
		...f.capture,
		videoReference: {
			...f.capture.videoReference!,
			record: f.record.id,
			revision: f.record.source.commit
		}
	};
	const directory = join(root, '.cache/capture-protocol');
	mkdirSync(directory);
	const context: VideoGatherContext = {
		repository: root,
		source: { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') },
		slots: [
			{
				unit: 'component.player',
				clipId: 'play',
				viewport: 'desktop',
				inputHash: f.input.video.inputHash
			}
		],
		pinned: {
			evidence: git('rev-parse', 'refs/heads/harness-evidence'),
			notes: git('rev-parse', 'refs/notes/harness')
		}
	};
	const write = (value: Capture = capture) => {
		const { path, status, sha256, bytes, capturedAt, ...wire } = value;
		void status;
		void sha256;
		void bytes;
		void capturedAt;
		writeFileSync(
			join(directory, 'captures.ndjson'),
			JSON.stringify({ ...wire, file: basename(path) }) + '\n'
		);
		writeFileSync(
			join(directory, 'video-batches.json'),
			JSON.stringify({
				schemaVersion: 1,
				batches: f.pointers,
				captures: [{ file: basename(path), capture: value }]
			})
		);
	};
	write();
	const scenario = gatherVideoScenario();
	return { ...f, capture, directory, context, write, scenario };
}

function gatherVideoScenario() {
	return scenarioManifestSchema.parse({
		schemaVersion: 1,
		id: 'player',
		title: 'Player',
		kind: 'ui',
		units: ['component.player'],
		states: [{ id: 'playing', title: 'Playing', coverage: 'required' }],
		viewports: [{ id: 'desktop', width: 160, height: 120 }],
		tests: [{ id: 'video', kind: 'unit', runner: 'command', target: 'video' }],
		evidence: [
			{
				id: 'motion',
				required: true,
				kind: 'video',
				states: ['playing'],
				viewports: ['desktop'],
				build: 'preview'
			}
		]
	});
}
