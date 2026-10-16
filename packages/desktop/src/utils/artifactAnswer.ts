import type { HarnessCapture } from '../../../reports/src/models/Harness.types';
import type { EvidenceArtifactResult } from '../models/DesktopEvidence.types';
import { artifactLimit, artifactMedia } from './artifactMedia';

type Listed = Pick<HarnessCapture, 'kind' | 'mediaType' | 'sha256' | 'media' | 'gap'>;

const hex = (bytes: Uint8Array) =>
	[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');

/**
 * The answer for one listed capture and the bytes its sealed record holds for it. The bytes are
 * answered only when they are stored, are no more than one artifact may be, have the hash the
 * capture states when hashed again here, and are what a capture of that kind may be served as.
 * Anything else is refused in words; the capture stays listed by the evidence either way.
 */
export async function artifactAnswer(
	capture: Listed,
	bytes: Uint8Array | undefined
): Promise<EvidenceArtifactResult> {
	if (capture.media === null || !bytes) {
		const gap = capture.gap ?? 'its record does not hold them';
		throw new Error(`The bytes of this capture are not stored: ${gap}.`);
	}
	if (bytes.length > artifactLimit) {
		const most = `at most ${artifactLimit} bytes (11 MiB) are read here`;
		throw new Error(`This capture has ${bytes.length} bytes; ${most}.`);
	}
	const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
	if (hex(new Uint8Array(digest)) !== capture.sha256)
		throw new Error('The stored bytes do not have the recorded SHA-256.');
	return { bytes, mediaType: artifactMedia(capture, bytes), sha256: capture.sha256 };
}
