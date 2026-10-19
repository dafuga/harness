import {
	artifactMediaTypes,
	unshownArtifact,
	artifactLimit,
	largeArtifact,
	otherArtifact
} from '../../utils/remoteArtifact';
import type { EvidenceArtifactResult } from '../../models/DesktopEvidence.types.ts';
import type { RemoteBinary } from '../../models/Environment.types.ts';
import { remoteBinary } from '../../utils/remoteBinary';

/**
 * One artifact of recorded evidence, as a computer sent it or as the phone kept it, decoded to
 * its bytes. It is given only when it is of a safe kind, inside the size limit and the hash that
 * was asked for, and when its bytes are exactly what it states.
 */
export async function remoteArtifact(
	value: RemoteBinary,
	asked: string | undefined
): Promise<EvidenceArtifactResult> {
	const { mediaType, byteLength, sha256 } = (value ?? {}) as Partial<RemoteBinary>;
	if (!mediaType || !artifactMediaTypes.includes(mediaType)) throw new Error(unshownArtifact);
	if (Number(byteLength) > artifactLimit) throw new Error(largeArtifact);
	if (!sha256 || sha256 !== asked) throw new Error(otherArtifact);
	return { bytes: await remoteBinary(value), mediaType, sha256 };
}
