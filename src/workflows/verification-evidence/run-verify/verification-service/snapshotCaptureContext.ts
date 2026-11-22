// @harness-uid u_x7kddegtw2
import { GitAdapter } from '../../../../adapters/git-source-history/GitAdapter';
import { evidenceRef, notesRef } from '../../../../core/git-source-history/historyTypes';
import type { SnapshotRun } from './SnapshotRunService.types';
import type { VideoSlot } from '../../../../services/verification-evidence/VideoEvidenceService.types';
import type { VideoRunContext } from './check-run-service/CheckRunService.types';

/** Unenrolled runs perform no new branch or LFS reads. */
export async function snapshotCaptureContext(
	run: SnapshotRun,
	slots: Record<string, VideoSlot[]>
): Promise<VideoRunContext | undefined> {
	if (!Object.values(slots).some((items) => items.length)) return undefined;
	const git = new GitAdapter(run.root);
	const [evidence, notes] = await Promise.all(
		[evidenceRef, notesRef].map((ref) => git.attempt(['rev-parse', '--verify', ref]))
	);
	return {
		repository: run.root,
		source: { commit: run.context.commit, tree: run.context.tree },
		slots,
		pinned: { evidence: evidence ?? null, notes: notes ?? null }
	};
}
