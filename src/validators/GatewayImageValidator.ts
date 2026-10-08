import { gatewayContentError } from '../utils/gatewayContentError';

export interface GatewayImage {
	data: string;
	mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}
const signatures = {
	'image/png': (bytes: Buffer) =>
		bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
	'image/jpeg': (bytes: Buffer) => bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
	'image/gif': (bytes: Buffer) => ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)),
	'image/webp': (bytes: Buffer) =>
		bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
};

export class GatewayImageValidator {
	parse(input: Record<string, unknown>): GatewayImage {
		const uri = this.dataUri(input.image_url);
		const source = this.source(input);
		return this.bytes(uri?.[1] ?? source.mime, uri?.[2] ?? source.data);
	}

	private dataUri(value: unknown): RegExpExecArray | null {
		const url =
			typeof value === 'object' && value !== null ? (value as Record<string, unknown>).url : value;
		return typeof url === 'string' ? /^data:([^;,]+);base64,(.*)$/s.exec(url) : null;
	}

	private source(input: Record<string, unknown>): { mime: unknown; data: unknown } {
		if (input.resource && typeof input.resource === 'object') {
			const resource = input.resource as Record<string, unknown>;
			return { mime: resource.mimeType, data: resource.blob };
		}
		if (input.source && typeof input.source === 'object') {
			const source = input.source as Record<string, unknown>;
			return { mime: source.media_type, data: source.data };
		}
		return { mime: input.mimeType, data: input.data };
	}

	private bytes(mime: unknown, data: unknown): GatewayImage {
		if (typeof mime !== 'string' || !Object.hasOwn(signatures, mime) || typeof data !== 'string')
			throw gatewayContentError(
				'Image bytes are required as a PNG, JPEG, GIF or WebP base64 block. Image URLs, local paths and provider file IDs are unsupported.'
			);
		if (data.length > 7_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data))
			throw gatewayContentError('Image data is invalid or exceeds the 5 MiB image limit.');
		const bytes = Buffer.from(data, 'base64');
		if (
			bytes.length > 5 * 1024 * 1024 ||
			bytes.toString('base64') !== data ||
			!signatures[mime as GatewayImage['mimeType']](bytes)
		)
			throw gatewayContentError('Image data is invalid or does not match its media type.');
		return { data, mimeType: mime as GatewayImage['mimeType'] };
	}
}
