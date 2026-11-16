// @harness-uid u_dilltr2si4
export type CryptoSource = Parameters<SubtleCrypto['digest']>[1];
/** Base64 or base64url text that the strict decoders refuse. */
export class InvalidBase64Error extends Error {
	override name = 'InvalidBase64Error';
}
