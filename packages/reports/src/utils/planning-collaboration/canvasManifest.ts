// @harness-uid u_dscanvfmta
import type { CanvasArtboard, CanvasManifest } from './designCanvas.types';
import { DesignCanvasError } from '../../models/planning-collaboration/DesignCanvasError';

/** Where a project keeps its canvases: one folder each, committed like any other source. */
export const designsRoot = 'designs';
export const canvasFile = 'canvas.json';
export const maxArtboards = 60;
export const maxArtboardBytes = 512 * 1024;

export const isCanvasName = (name: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(name);
export const isArtboardName = (name: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name);
export const isArtboardFile = (file: string) =>
	file.endsWith('.html') && isArtboardName(file.slice(0, -5));

/** Reads `canvas.json`. The order of `artboards` is the order on the canvas. */
export function canvasManifest(text: string): CanvasManifest {
	const value = record(json(text));
	if (value.schemaVersion !== 1) throw new DesignCanvasError('schemaVersion must be 1');
	if (!Array.isArray(value.artboards) || value.artboards.length > maxArtboards)
		throw new DesignCanvasError(`artboards must be a list of at most ${maxArtboards}`);
	const artboards = value.artboards.map(artboard);
	if (new Set(artboards.map((a) => a.file.toLowerCase())).size !== artboards.length)
		throw new DesignCanvasError('artboard files must be unique');
	return { schemaVersion: 1, title: title(value.title), artboards };
}

function artboard(input: unknown): CanvasArtboard {
	const value = record(input);
	const { file, x, y } = value;
	if (typeof file !== 'string' || !isArtboardFile(file))
		throw new DesignCanvasError('every artboard needs a <Name>.html file');
	const entry = { file, title: title(value.title) };
	if (x === undefined && y === undefined) return entry;
	if (!isPosition(x) || !isPosition(y))
		throw new DesignCanvasError(`${file}: x and y must both be numbers`);
	return { ...entry, x, y };
}

const isPosition = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100000;

function title(value: unknown): string {
	if (typeof value !== 'string' || !value.trim() || value.length > 120)
		throw new DesignCanvasError('every title needs 1-120 characters');
	return value;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new DesignCanvasError(`${canvasFile} must hold an object`);
	return value as Record<string, unknown>;
}

function json(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		throw new DesignCanvasError(`${canvasFile} is not JSON`);
	}
}
