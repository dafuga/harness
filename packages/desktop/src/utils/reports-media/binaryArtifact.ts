// @harness-uid u_2evzki4xia
import type { RemoteBinary } from '../../../../remote/src/index';
import type { EvidenceArtifactResult } from '../../models/verification-evidence/DesktopEvidence.types';
import { remoteBinary, unreadableMedia } from '../networking-security/remoteBinary';
import { InvalidMediaTypeError } from './binaryArtifact.types';

/**
 * An artifact that crossed a transport, as the page is given it: its bytes, decoded and checked
 * against the length and the hash that were sent with them, the media type its backend attested
 * and that hash. Bytes that are not exactly what was sent are refused.
 */
export async function binaryArtifact(value: RemoteBinary): Promise<EvidenceArtifactResult> {
	if (typeof value?.mediaType !== 'string') throw new InvalidMediaTypeError(unreadableMedia);
	return { bytes: await remoteBinary(value), mediaType: value.mediaType, sha256: value.sha256 };
}
