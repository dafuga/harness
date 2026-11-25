// @harness-uid u_mkdsgnc4nv
import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { relative } from 'node:path';
import { promisify } from 'node:util';
import { DesignCanvasService } from '../../../../../../src/services/planning-collaboration/design-canvas-service/DesignCanvasService';
import type { DesignCanvasPage } from '$reports/utils/planning-collaboration/designCanvas.types';
import { CanvasOutsideProjectError } from './CanvasOutsideProjectError';

/**
 * The canvases as they are in the checked-out working tree: the branch's version, with whatever an
 * agent has not committed yet. A designs folder that links out of the project is not read.
 */
export async function localDesignCanvases(
	root: string,
	asked: string | null
): Promise<DesignCanvasPage> {
	const service = new DesignCanvasService(root);
	const names = service.names();
	const name = asked ?? names[0];
	for (const found of names) await inside(root, service.folder(found));
	if (asked && !names.includes(asked))
		throw new CanvasOutsideProjectError(`This project has no canvas named ${asked}.`);
	const [commit, branch] = await Promise.all([
		git(root, 'rev-parse', 'HEAD'),
		git(root, 'rev-parse', '--abbrev-ref', 'HEAD')
	]);
	return {
		commit,
		branch,
		branches: [branch],
		canvases: names.map((entry) => summary(service, entry)),
		canvas: name ? service.read(name) : null
	};
}

function summary(service: DesignCanvasService, name: string) {
	try {
		const { title, artboards } = service.manifest(name);
		return { name, title, artboards: artboards.length };
	} catch {
		return { name, title: `${name} (unreadable canvas.json)`, artboards: 0 };
	}
}

async function inside(root: string, folder: string): Promise<void> {
	const path = relative(await realpath(root), await realpath(folder));
	if (path.startsWith('..') || path.startsWith('/'))
		throw new CanvasOutsideProjectError('A canvas folder links outside the project.');
}

async function git(root: string, ...args: string[]): Promise<string> {
	return (await promisify(execFile)('git', args, { cwd: root })).stdout.trim();
}
