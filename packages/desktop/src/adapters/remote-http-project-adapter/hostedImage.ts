import { createHash } from "node:crypto";
import { ImageBytesValidator } from "../../validators/ImageBytesValidator";

export function hostedImage(value: unknown, sha256: string) {
	if (typeof value !== 'string') throw new Error('Invalid cached image.');
	const bytes = new Uint8Array(Buffer.from(value, 'base64'));
	if (bytes.length > 25000000 || createHash('sha256').update(bytes).digest('hex') !== sha256)
		throw new Error('Hosted image hash mismatch.');
	return new ImageBytesValidator().validate(bytes);
}
