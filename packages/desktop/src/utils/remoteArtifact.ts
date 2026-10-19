import type { EvidenceArtifactResult } from '../models/DesktopEvidence.types';
import type { RemoteBinary } from '../models/Environment.types';
import { remoteBinary } from './remoteBinary';

/** The most raw bytes of one recorded artifact. A larger one is refused, never cut. */
export const artifactLimit = 11 * 1024 * 1024;
/**
 * What a recorded artifact may be, by the one name a computer serves each as: a screenshot,
 * recorded sound, data or plain text. Markup and anything a browser would run are not in it.
 */
export const artifactMediaTypes: readonly string[] = [
	'image/png',
	'image/jpeg',
	'audio/wav',
	'audio/mpeg',
	'audio/mp4',
	'audio/ogg',
	'application/json',
	'text/plain; charset=utf-8'
];
export const unshownArtifact =
	'The computer sent a recorded file of a kind this app does not show.';
export const largeArtifact = 'The recorded file is too large to be read on this connection.';
export const otherArtifact = 'The computer sent another recorded file than the one asked for.';

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
