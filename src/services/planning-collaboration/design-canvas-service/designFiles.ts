// @harness-uid u_jbzdb34xy3
import { lstatSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';

/** A regular file's text, or null when there is none; a link out of the canvas is refused. */
export function readText(path: string): string | null {
	const found = lstatSync(path, { throwIfNoEntry: false });
	if (!found) return null;
	if (!found.isFile()) throw new DesignCanvasError(`${path} is not a regular file.`);
	return readFileSync(path, 'utf8');
}

/** Replaces a file in one step, so a viewer never reads half of it. */
export function writeText(path: string, text: string): void {
	const draft = `${path}.${process.pid}.tmp`;
	writeFileSync(draft, text, { flag: 'wx' });
	renameSync(draft, path);
}
