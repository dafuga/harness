import { unreadArtifact, damagedArtifact } from '../../utils/artifactBytes';
import type { DesktopBridge } from '../../models/DesktopBridge.types.ts';
import type {
	EvidenceArtifactQuery,
	EvidenceArtifactResult
} from '../../models/DesktopEvidence.types.ts';

const hex = (bytes: Uint8Array) =>
	[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');

/**
 * The bytes of one capture, read through the bridge and hashed again here. An answer whose
 * bytes do not have the hash the capture states is refused, whatever it says of itself, so a
 * picture or a clip is never shown from bytes that are not the recorded ones.
 */
export async function artifactBytes(
	bridge: Pick<DesktopBridge, 'artifact'>,
	query: EvidenceArtifactQuery
): Promise<EvidenceArtifactResult> {
	if (!bridge.artifact) throw new Error(unreadArtifact);
	const answer = await bridge.artifact(query);
	const bytes = new Uint8Array(answer.bytes);
	const sha256 = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
	if (sha256 !== query.sha256) throw new Error(damagedArtifact);
	return { bytes, mediaType: answer.mediaType, sha256 };
}
