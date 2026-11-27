// @harness-uid u_ex7sjre6fh
import { artifactMediaTypes } from '../../../utils/verification-evidence/remoteArtifact';
import { BrowserArtifactError } from './browserArtifact.types';
import { hostedArtifact } from './hostedArtifact';
import type {
	AttestedMedia,
	EvidenceArtifactResult
} from '../../../models/verification-evidence/DesktopEvidence.types';

/** Browsers accept only the exact attested media names and the bytes bound to the capture. */
export async function browserArtifact(
	media: AttestedMedia,
	sha256: string
): Promise<EvidenceArtifactResult> {
	const refused = 'The service sent a file of a kind this page does not show.';
	if (!artifactMediaTypes.includes(media.mediaType)) throw new BrowserArtifactError(refused);
	try {
		return await hostedArtifact(media, sha256);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message.includes('SHA-256')) throw error;
		if (message.includes('11 MiB'))
			throw new BrowserArtifactError('The recorded file is too large for this page.');
		throw new BrowserArtifactError(refused);
	}
}
