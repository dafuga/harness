// @harness-uid u_x7kddegtw2
import type { SnapshotAdapter } from '../../../../adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import type { SnapshotRun } from './SnapshotRunService.types';
import type { SnapshotVideoRun } from './snapshotVideoRun.types';
import type { CaptureLimits } from './check-run-service/captureLimits.types';
import { snapshotVideoInputs } from './snapshotVideoInputs';
import { pendingVideoEnvironment } from './snapshotVideoFlags';
import { CheckRunService } from './check-run-service/CheckRunService';
import { snapshotCaptureContext } from './snapshotCaptureContext';

export async function snapshotVideoRun(
	run: SnapshotRun,
	snapshot: string,
	limits: CaptureLimits
): Promise<SnapshotVideoRun> {
	const { failures, ...videoInputs } = await snapshotVideoInputs(
		snapshot,
		run.videos ?? [],
		run.root
	);
	const runner = new CheckRunService({
		...run.context,
		snapshot,
		limits,
		videoCapture: await snapshotCaptureContext(run, videoInputs.videoSlots),
		env: pendingVideoEnvironment(run.context.env, videoInputs.pendingVideoFlags)
	});
	return { runner, failures, videoInputs };
}

export function snapshotDriftObserver(
	snapshot: SnapshotAdapter,
	seen: { mutated: Set<string>; added: Set<string> }
): () => Promise<void> {
	return async () => {
		const drift = await snapshot.drift();
		for (const path of drift.mutated) seen.mutated.add(path);
		for (const path of drift.added) seen.added.add(path);
	};
}
