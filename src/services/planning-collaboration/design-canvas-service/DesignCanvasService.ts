// @harness-uid u_dscanvsvca
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { canvasBoards } from '../../../../packages/reports/src/utils/planning-collaboration/canvasBoards';
import {
	canvasFile,
	canvasManifest,
	designsRoot,
	isArtboardName,
	isCanvasName,
	maxArtboards
} from '../../../../packages/reports/src/utils/planning-collaboration/canvasManifest';
import type {
	CanvasManifest,
	DesignCanvasData
} from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';
import { artboardSource } from './artboardSource';
import { editArtboard } from './editArtboard';
import { readText, writeText } from './designFiles';
import type { ArtboardChange } from './DesignCanvasService.types';

/** The canvases committed under a project's `designs/` folder. */
export class DesignCanvasService {
	constructor(readonly root: string) {}

	folder(name: string): string {
		if (!isCanvasName(name))
			throw new DesignCanvasError('A canvas name is lower-case letters, digits and dashes.');
		return join(this.root, designsRoot, name);
	}

	names(): string[] {
		const base = join(this.root, designsRoot);
		if (!existsSync(base)) return [];
		return readdirSync(base, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && isCanvasName(entry.name))
			.filter((entry) => existsSync(join(base, entry.name, canvasFile)))
			.map((entry) => entry.name)
			.sort();
	}

	manifest(name: string): CanvasManifest {
		const text = readText(join(this.folder(name), canvasFile));
		if (text === null) throw new DesignCanvasError(`No canvas named ${name}.`);
		return canvasManifest(text);
	}

	read(name: string): DesignCanvasData {
		const manifest = this.manifest(name);
		const sources = new Map<string, string>();
		for (const { file } of manifest.artboards) {
			const html = readText(join(this.folder(name), file));
			if (html !== null) sources.set(file, html);
		}
		return { name, title: manifest.title, boards: canvasBoards(manifest, sources) };
	}

	create(name: string, title: string = name): string {
		const folder = this.folder(name);
		if (existsSync(join(folder, canvasFile)))
			throw new DesignCanvasError(`Canvas ${name} already exists.`);
		mkdirSync(folder, { recursive: true });
		this.save(name, { schemaVersion: 1, title, artboards: [] });
		return folder;
	}

	add(name: string, board: string, change: ArtboardChange): string {
		const manifest = this.manifest(name);
		if (!isArtboardName(board))
			throw new DesignCanvasError('An artboard name is letters, digits, dashes and underscores.');
		const file = `${board}.html`;
		if (manifest.artboards.some((a) => a.file.toLowerCase() === file.toLowerCase()))
			throw new DesignCanvasError(`${file} is already on this canvas; use update.`);
		if (manifest.artboards.length >= maxArtboards)
			throw new DesignCanvasError(`A canvas holds at most ${maxArtboards} artboards.`);
		const title = change.title ?? board;
		const html = artboardSource({ ...change, title });
		const artboards = editArtboard([...manifest.artboards, { file, title }], file, change);
		writeText(join(this.folder(name), file), html);
		this.save(name, { ...manifest, artboards });
		return join(this.folder(name), file);
	}

	update(name: string, board: string, change: ArtboardChange): string {
		const manifest = this.manifest(name);
		const file = `${board}.html`;
		if (!manifest.artboards.some((a) => a.file === file))
			throw new DesignCanvasError(`No artboard ${board} on ${name}; use add.`);
		const html = change.html === undefined ? undefined : artboardSource(change);
		const artboards = editArtboard(manifest.artboards, file, change);
		if (html !== undefined) writeText(join(this.folder(name), file), html);
		this.save(name, { ...manifest, artboards });
		return join(this.folder(name), file);
	}

	private save(name: string, manifest: CanvasManifest): void {
		const text = JSON.stringify(manifest, null, '\t') + '\n';
		canvasManifest(text);
		writeText(join(this.folder(name), canvasFile), text);
	}
}
