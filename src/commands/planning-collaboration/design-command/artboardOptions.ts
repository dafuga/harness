// @harness-uid u_gcr4ee6amg
import { readFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';
import { parseArtboardSize } from '../../../../packages/reports/src/utils/planning-collaboration/artboardSize';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';
import type { ArtboardChange } from '../../../services/planning-collaboration/design-canvas-service/DesignCanvasService.types';

/** The command-line options of `add` and `update` as one artboard change. */
export async function artboardOptions(
	options: Record<string, string | undefined>
): Promise<ArtboardChange> {
	const { title, from, size, order, at } = options;
	return {
		...(title === undefined ? {} : { title }),
		...(from === undefined ? {} : { html: await source(from) }),
		...(size === undefined ? {} : { size: sizeOption(size) }),
		...(order === undefined ? {} : { order: Number(order) }),
		...(at === undefined ? {} : { position: positionOption(at) })
	};
}

const source = (from: string) => (from === '-' ? text(process.stdin) : readFile(from, 'utf8'));

function sizeOption(value: string) {
	const size = parseArtboardSize(value);
	if (!size) throw new DesignCanvasError('--size is desktop, tablet, mobile or WIDTHxHEIGHT.');
	return size;
}

function positionOption(value: string) {
	if (value === 'row') return null;
	const match = /^(-?\d+),(-?\d+)$/.exec(value);
	if (!match) throw new DesignCanvasError('--at is x,y or row.');
	return { x: Number(match[1]), y: Number(match[2]) };
}
