// @harness-uid u_si33ircueg
import { errorMessage } from '$reports/helpers/strings/errorMessage';
import type {
	AttestedMedia,
	EvidenceArtifactResult
} from '../../../models/verification-evidence/DesktopEvidence.types';
import { artifactAnswer } from '../../../utils/verification-evidence/artifact-answer/artifactAnswer';
import { HostedArtifactRefusedError } from './hostedArtifact.types';

/** The kinds this app shows, each with the media types the hosted service may attest for it. */
const shown: Array<[kind: string, types: string[]]> = [
	['screenshot', ['image/png', 'image/jpeg']],
	['audio', ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg']],
	['output', ['application/json', 'text/plain']]
];

/** A server-attested MIME must itself belong to the supported list before byte sniffing. */
export async function hostedArtifact(
	media: AttestedMedia,
	sha256: string
): Promise<EvidenceArtifactResult> {
	const type = media.mediaType.split(';')[0].trim().toLowerCase();
	const kind = shown.find(([, types]) => types.includes(type))?.[0];
	if (!kind)
		throw new HostedArtifactRefusedError('The hosted service sent a kind this app does not show.');
	let result: EvidenceArtifactResult;
	try {
		result = await artifactAnswer({ kind, mediaType: type, sha256, media: 'stored' }, media.bytes);
	} catch (error) {
		const message = errorMessage(error);
		if (message.includes('SHA-256'))
			throw new HostedArtifactRefusedError(
				'This is not the recorded file that was asked for (SHA-256).'
			);
		if (message.includes('11 MiB')) throw error;
		throw new HostedArtifactRefusedError('The hosted service sent a kind this app does not show.');
	}
	if (result.mediaType.split(';')[0] !== type)
		throw new HostedArtifactRefusedError('The hosted service sent a kind this app does not show.');
	return result;
}
