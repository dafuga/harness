// @harness-uid u_wd5jkouu2k
import {
	artboardPresets,
	artboardSize
} from '../../../../packages/reports/src/utils/planning-collaboration/artboardSize';
import { artboardViolations } from '../../../../packages/reports/src/utils/planning-collaboration/artboardViolations';
import { maxArtboardBytes } from '../../../../packages/reports/src/utils/planning-collaboration/canvasManifest';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';
import type { ArtboardSize } from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';
import type { ArtboardChange } from './DesignCanvasService.types';
import { starterArtboard } from './starterArtboard';

const sizeMeta = ({ width, height }: ArtboardSize) =>
	`<meta name="artboard-size" content="${width}x${height}">`;

/**
 * The file an artboard is saved as: the given HTML, or a starter page. HTML that declares no size
 * takes `size`; HTML that declares another one is refused rather than silently resized.
 */
export function artboardSource({ html, size, title = 'Artboard' }: ArtboardChange): string {
	if (html === undefined) return starterArtboard(title, sizeMeta(size ?? artboardPresets.desktop));
	return checked(sized(html, size));
}

function sized(html: string, size: ArtboardSize | undefined): string {
	const declared = artboardSize(html);
	if (!size) return html;
	if (!declared) return withSize(html, size);
	if (declared.width !== size.width || declared.height !== size.height)
		throw new DesignCanvasError(
			`--size differs from the file's artboard-size ${declared.width}x${declared.height}.`
		);
	return html;
}

function checked(html: string): string {
	const problems = artboardViolations(html);
	if (Buffer.byteLength(html) > maxArtboardBytes) problems.push('is larger than 512 KB');
	if (problems.length) throw new DesignCanvasError(`The artboard ${problems.join('; ')}.`);
	return html;
}

function withSize(html: string, size: ArtboardSize): string {
	const start = /^\s*(?:<!doctype[^>]*>)?(?:\s*<html[^>]*>)?(?:\s*<head[^>]*>)?/i.exec(html)![0];
	return `${start}\n${sizeMeta(size)}${html.slice(start.length)}`;
}
