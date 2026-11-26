// @harness-uid u_6ge2cfqn3l
import {
	canvasFile,
	canvasManifest,
	designsRoot,
	maxArtboardBytes
} from '$reports/utils/planning-collaboration/canvasManifest';
import { canvasBoards } from '$reports/utils/planning-collaboration/canvasBoards';
import type {
	CanvasManifest,
	DesignCanvasData,
	DesignCanvasPage
} from '$reports/utils/planning-collaboration/designCanvas.types';
import { hubSource, hubRead } from '../../../../utils/development-tooling/hubSource';
import type { HubSourceContext } from '../../../../utils/development-tooling/hubSource';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
import type { DesignCanvasQuery, Input } from './hubDesignCanvases.types';

const manifestPath = new RegExp(`^${designsRoot}/([a-z0-9][a-z0-9-]{0,63})/${canvasFile}$`);
const maxCanvases = 100;
const oversized = ' '.repeat(maxArtboardBytes + 1);
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/**
 * The canvases committed at a branch's tip, or at one commit, with the artboards of the asked
 * canvas (else the first). Membership was checked by the caller's project read.
 */
export async function hubDesignCanvases(
	input: Input,
	query: DesignCanvasQuery
): Promise<DesignCanvasPage> {
	const { context, branch, branches } = await revision(input, query);
	const found = await manifests(context);
	const asked = query.canvas ?? [...found.keys()][0];
	if (query.canvas && !found.has(query.canvas)) return hubFail('not-found');
	return {
		commit: context.commit,
		branch,
		branches,
		canvases: [...found].map(summary),
		canvas: asked ? await canvas(context, asked, found.get(asked) ?? null) : null
	};
}

/** The asked branch, else the default one; a pinned commit needs no branch that still exists. */
async function revision(input: Input, query: DesignCanvasQuery) {
	const all = await input.source.branches(input.project.sourceRepository);
	const named = (name: string) => all.find((b) => b.name === name);
	const branch = query.branch ? named(query.branch) : (named('main') ?? all[0]);
	const ref = query.commit ?? (branch && `refs/heads/${branch.name}`);
	if (!ref) return hubFail('not-found');
	return {
		context: await hubSource({ ...input, ref }),
		branch: branch?.name ?? query.branch ?? '',
		branches: all.map((b) => b.name)
	};
}

function summary([name, manifest]: [string, CanvasManifest | null]) {
	return {
		name,
		title: manifest?.title ?? `${name} (unreadable ${canvasFile})`,
		artboards: manifest?.artboards.length ?? 0
	};
}

/** A broken manifest stays listed as null, so one bad canvas never hides the others. */
async function manifests(context: HubSourceContext) {
	const paths = context.entries
		.map((entry) => manifestPath.exec(entry.path))
		.filter((match) => match !== null)
		.sort((a, b) => a[1].localeCompare(b[1]))
		.slice(0, maxCanvases);
	const read = paths.map(async ([path, name]) => {
		const text = decode(await hubRead(context, path));
		try {
			return [name, canvasManifest(text)] as const;
		} catch {
			return [name, null] as const;
		}
	});
	return new Map<string, CanvasManifest | null>(await Promise.all(read));
}

async function canvas(
	context: HubSourceContext,
	name: string,
	manifest: CanvasManifest | null
): Promise<DesignCanvasData> {
	if (!manifest) return hubFail();
	const sources = new Map<string, string>();
	await Promise.all(
		manifest.artboards.map(async ({ file }) => {
			const path = `${designsRoot}/${name}/${file}`;
			const entry = context.entries.find((e) => e.path === path && e.type === 'blob');
			// A link or a directory is not an artboard: the board says its file is missing.
			if (!entry || !['100644', '100755'].includes(entry.mode)) return;
			const large = (entry.size ?? 0) > maxArtboardBytes;
			sources.set(file, large ? oversized : decode(await hubRead(context, path)));
		})
	);
	return { name, title: manifest.title, boards: canvasBoards(manifest, sources) };
}
