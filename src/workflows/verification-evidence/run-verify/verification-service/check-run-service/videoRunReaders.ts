// @harness-uid u_3exag5gqwq
import { VideoReferenceService } from '../../../../../services/verification-evidence/VideoReferenceService';
import type { VideoGatherContext } from './gatherVideoReferences.types';

/** One lazy reader per immutable reuse pin/fresh scope, shared across every row and check. */
export function videoRunReaders(
	context: Pick<VideoGatherContext, 'repository' | 'pinned' | 'references'>
): NonNullable<VideoGatherContext['references']> {
	if (context.references) return context.references;
	const readers = new Map<boolean, VideoReferenceService>();
	return (fresh) => {
		let reader = readers.get(fresh);
		if (!reader) {
			reader = new VideoReferenceService(context.repository, fresh ? undefined : context.pinned);
			readers.set(fresh, reader);
		}
		return reader;
	};
}
