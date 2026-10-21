const marker = 'harness-build:';

/** Every stamp slot, filled or empty, in emitted text. */
export const buildStampPattern = /harness-build:[0-9a-f]{64}/g;

/** The package a console answers from; a test keeps it equal to package.json. */
export const sdkPackage = { name: '@dafuga01/harness', version: '0.1.3' };

/**
 * A slot as generated code holds it until `harness verify stamp` writes the identity of the
 * emitted files there. It is put together when asked for, so this code holds no slot itself.
 */
export function emptyBuildStamp(): string {
	return `${marker}${'0'.repeat(64)}`;
}

/**
 * The identity stamped into a slot, or null when it was never stamped. A server that cannot read
 * its own files, such as a Worker, passes the slot its emitted code holds, so what it reports is
 * part of the build it really runs and not a label it was started with.
 */
export function buildStamp(slot?: string): string | null {
	const value = slot?.startsWith(marker) ? slot.slice(marker.length) : '';
	return /^[0-9a-f]{64}$/.test(value) && !/^0+$/.test(value) ? value : null;
}
