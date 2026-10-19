

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Eight characters a person types from the desktop app into the approval page. */
export function userCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const text = [...bytes].map((byte) => CODE_ALPHABET[byte & 31]).join('');
	return `${text.slice(0, 4)}-${text.slice(4)}`;
}

export function normalizeCode(value: string): string {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
