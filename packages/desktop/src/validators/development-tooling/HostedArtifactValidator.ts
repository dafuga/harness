// @harness-uid u_lyv6pkc24d
import { createHash } from 'node:crypto';
import { artifactLimit } from '../../utils/reports-media/artifactMedia';
import { artifactMedia } from '../../utils/verification-evidence/artifact-answer/artifactMedia';
import type {
	AttestedMedia,
	EvidenceArtifactResult
} from '../../models/verification-evidence/DesktopEvidence.types';
import {
	hostedAttestation,
	unshownHostedArtifact as unshown
} from '../../utils/networking-security/hostedAttestation';
import { HostedArtifactRejectedError } from './HostedArtifactValidator.types';
/** Rehash every online or saved artifact and require an exactly supported MIME attestation. */
export class HostedArtifactValidator {
	artifact(media: AttestedMedia, sha256: string): EvidenceArtifactResult {
		if (media.bytes.length > artifactLimit)
			throw new HostedArtifactRejectedError('The capture exceeds 11 MiB.');
		if (
			!/^[a-f0-9]{64}$/.test(sha256) ||
			createHash('sha256').update(media.bytes).digest('hex') !== sha256
		)
			throw new HostedArtifactRejectedError(
				'This is not the recorded file that was asked for (SHA-256).'
			);
		const attested = hostedAttestation(media.mediaType);
		let served: string;
		try {
			served = artifactMedia(attested, media.bytes);
		} catch {
			throw new HostedArtifactRejectedError(unshown);
		}
		if (served.split(';')[0] !== attested.mediaType) throw new HostedArtifactRejectedError(unshown);
		return { bytes: media.bytes, mediaType: served, sha256 };
	}
}
