// @harness-uid u_wonpnpcvnk
/** Evidence source rejected: a symbolic link, a non-file, or a file over 50,000,000 bytes. */
export class InvalidEvidenceSourceError extends Error {
	override name = 'InvalidEvidenceSourceError';
}
