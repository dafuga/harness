// @harness-uid u_khpp77xvn3
import { createHash } from 'node:crypto';
import { ImageBytesValidator } from '../../../../validators/development-tooling/ImageBytesValidator';
import { InvalidHostedImageError } from './hostedImage.types';

export function hostedImage(value: unknown, sha256: string) {
	if (typeof value !== 'string') throw new InvalidHostedImageError('Invalid cached image.');
	const bytes = new Uint8Array(Buffer.from(value, 'base64'));
	if (bytes.length > 25000000 || createHash('sha256').update(bytes).digest('hex') !== sha256)
		throw new InvalidHostedImageError('Hosted image hash mismatch.');
	return new ImageBytesValidator().validate(bytes);
}
