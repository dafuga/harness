// @harness-uid u_q3z6auysrt
import type { CanvasArtboard } from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';
import type { ArtboardChange } from './DesignCanvasService.types';

/** The manifest list with one entry retitled, moved in the order or placed. */
export function editArtboard(
	artboards: readonly CanvasArtboard[],
	file: string,
	{ title, order, position }: ArtboardChange
): CanvasArtboard[] {
	const next = artboards.map((entry) => {
		if (entry.file !== file) return entry;
		const named = { ...entry, title: title ?? entry.title };
		if (position === undefined) return named;
		return position ? { ...named, ...position } : { file, title: named.title };
	});
	if (order === undefined) return next;
	if (!Number.isInteger(order) || order < 1 || order > next.length)
		throw new DesignCanvasError(`--order must be from 1 to ${next.length}.`);
	const [moved] = next.splice(
		next.findIndex((entry) => entry.file === file),
		1
	);
	next.splice(order - 1, 0, moved);
	return next;
}
