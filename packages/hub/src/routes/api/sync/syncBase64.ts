const alphabet = /^[A-Za-z0-9_-]*$/;

/** Base64url without padding, as every sealed id and envelope is spelled. */
export function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let at = 0; at < bytes.length; at += 0x8000)
		binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The bytes, or null when the text is not canonical base64url. */
export function fromBase64Url(text: string): Uint8Array | null {
	if (!alphabet.test(text) || text.length % 4 === 1) return null;
	try {
		const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		return toBase64Url(bytes) === text ? bytes : null;
	} catch {
		return null;
	}
}
