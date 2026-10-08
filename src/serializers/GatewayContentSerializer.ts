import { GatewayImageValidator, type GatewayImage } from '../validators/GatewayImageValidator';
import { gatewayContentError } from '../utils/gatewayContentError';
import type { GatewayItem } from '../utils/gatewayTypes';

export class GatewayContentSerializer {
	private readonly validator = new GatewayImageValidator();

	history(input: GatewayItem[]): { input: GatewayItem[]; images: GatewayImage[] } {
		const images: GatewayImage[] = [];
		const normalized = input.map((item) => this.visit(item, images, 0) as GatewayItem);
		return { input: normalized, images };
	}

	toolResult(output: string) {
		const images: GatewayImage[] = [];
		const parsed = this.json(output);
		const normalized = this.visit(parsed, images, 0);
		const text = images.length ? JSON.stringify(normalized) : output;
		const content = [
			{ type: 'text' as const, text },
			...images.map((image) => ({ type: 'image' as const, ...image }))
		];
		const failed =
			typeof parsed === 'object' &&
			parsed !== null &&
			'isError' in parsed &&
			parsed.isError === true;
		return { content, ...(failed ? { isError: true } : {}) };
	}

	private visit(value: unknown, images: GatewayImage[], depth: number): unknown {
		if (depth > 32) throw gatewayContentError('Content nesting exceeds the supported limit.');
		if (Array.isArray(value)) return value.map((entry) => this.visit(entry, images, depth + 1));
		if (typeof value !== 'object' || value === null) return value;
		const item = value as GatewayItem;
		if (this.isImage(item)) return this.image(item, images);
		if (
			['input_audio', 'output_audio', 'audio', 'input_video', 'video', 'input_file'].includes(
				String(item.type)
			)
		)
			throw gatewayContentError(
				'Audio, video and file attachments are unsupported by this Claude gateway. Supply text or inline images.'
			);
		if (item.type === 'resource' && typeof (item.resource as GatewayItem)?.blob === 'string')
			throw gatewayContentError(
				'Binary file resources are unsupported; supply readable text or inline image bytes.'
			);
		return Object.fromEntries(
			Object.entries(item).map(([key, entry]) => [
				key,
				this.visit(key === 'output' ? this.json(entry) : entry, images, depth + 1)
			])
		);
	}

	private image(item: GatewayItem, images: GatewayImage[]): GatewayItem {
		const image = this.validator.parse(item);
		images.push(image);
		const size = images.reduce(
			(total, entry) => total + Buffer.byteLength(entry.data, 'base64'),
			0
		);
		if (images.length > 20 || size > 20 * 1024 * 1024)
			throw gatewayContentError('A request supports at most 20 images and 20 MiB of image bytes.');
		const metadata = Object.fromEntries(
			Object.entries(item).filter(
				([key]) => !['data', 'image_url', 'source', 'resource'].includes(key)
			)
		);
		if (item.type === 'resource' && typeof item.resource === 'object' && item.resource !== null)
			metadata.resource = Object.fromEntries(
				Object.entries(item.resource).filter(([key]) => key !== 'blob')
			);
		return { ...metadata, image_reference: images.length, mimeType: image.mimeType };
	}

	private isImage(item: GatewayItem): boolean {
		const resource = item.resource as GatewayItem | undefined;
		return (
			['input_image', 'image_url', 'image'].includes(String(item.type)) ||
			(item.type === 'resource' && String(resource?.mimeType).startsWith('image/')) ||
			(item.type === 'resource_link' && String(item.mimeType).startsWith('image/'))
		);
	}

	private json(value: unknown): unknown {
		if (typeof value !== 'string') return value;
		const first = value.trimStart()[0];
		if (first !== '[' && first !== '{') return value;
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
}
