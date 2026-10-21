import { artifactMediaTypes } from '../../../utils/verification-evidence/remoteArtifact';
import { hostedArtifact } from './hostedArtifact';

/** Browsers accept only the exact attested media names and the bytes bound to the capture. */
export async function browserArtifact(
	media: { bytes: Uint8Array; mediaType: string },
	sha256: string
) {
	const refused = 'The service sent a file of a kind this page does not show.';
	if (!artifactMediaTypes.includes(media.mediaType)) throw new Error(refused);
	try {
		return await hostedArtifact(media, sha256);
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message.includes('SHA-256')) throw error;
		if (message.includes('11 MiB'))
			throw new Error('The recorded file is too large for this page.');
		throw new Error(refused);
	}
}
