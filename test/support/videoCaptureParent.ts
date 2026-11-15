import { basename } from 'node:path';
import { CommitTreeAdapter } from '../../src/adapters/git-source-history/CommitTreeAdapter';
import { SourceIndexService } from '../../src/services/development-tooling/source-index-service/SourceIndexService';
import { loadSide } from '../../src/workflows/development-tooling/loadRevisions';
import { componentVersion } from '../../src/utils/development-tooling/componentVersion';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';
import { referenceRecord, saveVideoParent } from './videoReferenceFixture';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import type { VideoCaptureResult } from '../../src/services/verification-evidence/VideoCaptureService.types';
import type { TemporaryRepo } from './temporary.types';

/** A real sealed parent and Git note, with canonical media held only in child archives. */
export async function attachCaptureParent(repo: TemporaryRepo, result: VideoCaptureResult) {
	const side = await loadSide(
		repo.root,
		await CommitTreeAdapter.open(repo.root, result.source.commit),
		new SourceIndexService()
	);
	const components = side.manifests.map((unit) => ({
		...componentVersion(unit, side.index.files),
		change: 'modified' as const,
		target: 'module' as const
	}));
	const captures = result.captures.map((capture) =>
		capture.videoReference?.record
			? capture
			: {
					...capture,
					path: `evidence/${result.source.commit}/capture/${capture.video!.clipId}/${basename(capture.path)}`
				}
	);
	const { id, ...base } = referenceRecord({
		source: { ...result.source, base: null },
		capture: captures.find((capture) => !capture.videoReference?.record) ?? captures[0],
		pointers: result.videoBatches,
		components
	});
	void id;
	const record = sealRecord({
		...base,
		scenarios: base.scenarios.map((scenario) => ({
			...scenario,
			states: scenario.states.map((state) => ({ ...state, captures }))
		}))
	});
	const stored = await saveVideoParent(repo.root, record);
	await new EvidenceAttachService(repo.root).attach(result.source.commit, stored);
	return record;
}
