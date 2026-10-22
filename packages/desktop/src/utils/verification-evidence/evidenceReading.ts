import type { ExplorerBehavior } from '../../../../reports/src/models/Explorer.types';
import type { ArtifactFetcher } from '../../../../reports/src/utils/explorerArtifact';
import { explorerReading } from '../../../../reports/src/utils/explorer-reading/explorerReading';
import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult
} from '../../models/verification-evidence/DesktopEvidence.types';
import { artifactQuery } from '../development-tooling/artifactQuery';

export interface EvidenceRead {
	/** The behaviour with every recorded result read, checked and compared. */
	behavior: ExplorerBehavior;
	/** Why the backend gave no bytes for a result, by the hash of that result, in its words. */
	refusals: Record<string, string>;
}

/** Only a name: `explorerReading` asks for `base + file`, and no address is made of it. */
const base = 'artifact:';
const unread = { ok: false, status: 0, arrayBuffer: async () => new ArrayBuffer(0) };
const words = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * The recorded behaviour of an evidence answer with every result read through the bridge. The
 * reading, the check of each hash and the comparison are those of the reports explorer; here a
 * result is only asked for by its binding, on the side that lists it. A result the backend
 * refuses is not read, and what the backend said is kept for it.
 */
export async function evidenceReading(
	bridge: Pick<DesktopBridge, 'artifact'>,
	result: EntityEvidenceResult,
	scope: EntityEvidenceQuery
): Promise<EvidenceRead> {
	const refusals: Record<string, string> = {};
	const fetcher: ArtifactFetcher = async (address) => {
		const file = address.slice(base.length);
		const query =
			artifactQuery(result, scope, 'after', file) ?? artifactQuery(result, scope, 'before', file);
		if (!query || !bridge.artifact) return unread;
		try {
			const { bytes } = await bridge.artifact(query);
			const body = new Uint8Array(bytes).buffer;
			return { ok: true, status: 200, arrayBuffer: async () => body };
		} catch (cause) {
			refusals[query.sha256] = words(cause);
			return unread;
		}
	};
	const behavior = await explorerReading(result.behavior, base, fetcher);
	return { behavior, refusals };
}
