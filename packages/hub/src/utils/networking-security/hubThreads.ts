import type { CommittedThread } from 'collaboration';
import type { ThreadInfo } from '../../../../desktop/src/models/Desktop.types';

export function hubThreads(threads: CommittedThread[], offset = 0): ThreadInfo[] {
	return [...threads]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((t, index) => ({
			id: t.id,
			pin: offset + index + 1,
			version: t.anchor.version,
			imageSha256: t.anchor.imageSha256,
			state: t.anchor.state,
			viewport: t.anchor.viewport,
			region: t.anchor.region,
			messageCount: t.comments.length
		}));
}

export { hubMessages } from '../../routes/api/[...path]/hub-projection-service/hubThreads';
