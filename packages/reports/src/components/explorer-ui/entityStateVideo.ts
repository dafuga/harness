// @harness-uid u_6yyo3qlu7t
import type { ExplorerEvidence } from '../../models/explorer-ui/Explorer.types';

export function latestVideoCoverage(evidence: ExplorerEvidence, scenarioId: string | undefined) {
	const records =
		evidence.after.detail?.records ?? (evidence.after.record ? [evidence.after.record] : []);
	return (
		records
			.filter((record) => record.valid && record.source.commit === evidence.after.commit)
			.sort((left, right) => right.finishedAt.localeCompare(left.finishedAt))
			.flatMap((record) => record.scenarios)
			.find((item) => item.id === scenarioId)?.videoCoverage ?? []
	);
}
