import { ipcFields } from '../ipcFields';
import type { Region } from '../../models/Desktop.types';

export function regionField(value: unknown): Region | null {
	if (value === null) return null;
	const r = ipcFields(value);
	const points = ['x', 'y', 'width', 'height'].map((k) => r[k]);
	if (!points.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1))
		throw new Error('Invalid image region.');
	const region = r as unknown as Region;
	if (
		!region.width ||
		!region.height ||
		region.x + region.width > 1.000001 ||
		region.y + region.height > 1.000001
	)
		throw new Error('Image region is outside the image.');
	return { x: region.x, y: region.y, width: region.width, height: region.height };
}
