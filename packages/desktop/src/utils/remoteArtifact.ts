

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

export { remoteArtifact } from '../adapters/capacitor-bridge-adapter/remoteArtifact';
