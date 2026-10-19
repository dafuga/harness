import { createHash } from 'node:crypto';
import { artifactLimit } from "../utils/artifactMedia";
import { artifactMedia } from "../utils/artifact-answer/artifactMedia";
import type { EvidenceArtifactResult } from '../models/DesktopEvidence.types';
import { hostedAttestation, unshownHostedArtifact as unshown } from '../utils/hostedAttestation';
/** Rehash every online or saved artifact and require an exactly supported MIME attestation. */
export class HostedArtifactValidator {
	artifact(
		media: { bytes: Uint8Array; mediaType: string },
		sha256: string
	): EvidenceArtifactResult {
		if (media.bytes.length > artifactLimit) throw new Error('The capture exceeds 11 MiB.');
		if (
			!/^[a-f0-9]{64}$/.test(sha256) ||
			createHash('sha256').update(media.bytes).digest('hex') !== sha256
		)
			throw new Error('This is not the recorded file that was asked for (SHA-256).');
		const attested = hostedAttestation(media.mediaType);
		let served: string;
		try {
			served = artifactMedia(attested, media.bytes);
		} catch {
			throw new Error(unshown);
		}
		if (served.split(';')[0] !== attested.mediaType) throw new Error(unshown);
		return { bytes: media.bytes, mediaType: served, sha256 };
	}
}
