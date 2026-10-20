import { randomBytes } from '../../utils/remoteBytes';

const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Eight characters a person reads on the computer and types on the phone, as `XXXX-XXXX`. */
export function pairingCode(): string {
	const text = [...randomBytes(8)].map((byte) => codeAlphabet[byte & 31]).join('');
	return `${text.slice(0, 4)}-${text.slice(4)}`;
}
