// @harness-uid u_hfud4vng54
import { realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type {
	ComponentManifest,
	ScenarioManifest
} from '../../../core/development-tooling/unitTypes';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { videoScriptExports } from './videoScriptExports';
import type { VideoClip } from '../../../utils/verification-evidence/videoClipSchema.types';
import type { VideoScenarioSourceContext } from './videoScenarioSources.types';

/** Shared source/owner/read caches for every enrolled scenario in one repository read. */
export async function videoScenarioSourceContext(
	tree: SourceTree,
	root: string,
	paths?: string[]
): Promise<VideoScenarioSourceContext> {
	return {
		tree,
		paths: new Set(paths ?? (await tree.list()).map((entry) => entry.path)),
		...(tree.revision === 'working-tree' ? { root: await realpath(root) } : {}),
		bounds: new Map(),
		texts: new Map(),
		owners: new Map(),
		exports: new Map()
	};
}

export async function videoScenarioSources(
	context: VideoScenarioSourceContext,
	scenario: ScenarioManifest
): Promise<string[]> {
	if (!scenario.video) return [];
	return (
		await Promise.all([
			...scenario.units.map((id) => ownerErrors(context, scenario, id)),
			...scenario.video.clips.map((clip) => clipErrors(context, clip, scenario.id))
		])
	).flat();
}

async function ownerErrors(
	context: VideoScenarioSourceContext,
	scenario: ScenarioManifest,
	id: string
): Promise<string[]> {
	const owner = await readOwner(context, id),
		errors: string[] = [];
	if (owner?.id !== id || owner.status !== 'active')
		return [`${scenario.id}: video owner ${id} must be registered and active`];
	const sources = Array.isArray(owner.owns?.source) ? owner.owns.source : [];
	if (!sources.length) errors.push(`${scenario.id}: video owner ${id} has no source bindings`);
	for (const path of sources) await checkPath(context, path, scenario.id, errors);
	if (
		owner.kind === 'page' &&
		!scenario.video!.graphs.some((graph) => graph.unit === id && graph.clips.length)
	)
		errors.push(`${scenario.id}: enrolled page ${id} needs an explicit feature graph with clips`);
	return errors;
}

async function clipErrors(
	context: VideoScenarioSourceContext,
	clip: VideoClip,
	scenario: string
): Promise<string[]> {
	const errors: string[] = [];
	for (const path of new Set([...clip.inputs, clip.fixture, clip.script.path]))
		await checkPath(context, path, scenario, errors);
	try {
		if (!/\.[cm]?[jt]sx?$/.test(clip.script.path))
			throw new ExpectedCliError(
				`Video script ${clip.script.path} must be JavaScript or TypeScript`
			);
		if (!context.exports.has(clip.script.path))
			context.exports.set(
				clip.script.path,
				readSource(context, clip.script.path).then((code) =>
					videoScriptExports(clip.script.path, code)
				)
			);
		if (!(await context.exports.get(clip.script.path)!).has(clip.script.export))
			errors.push(
				`${scenario}: video script ${clip.script.path} needs direct callable export ${clip.script.export}`
			);
	} catch (error) {
		errors.push(`${scenario}: ${errorMessage(error)}`);
	}
	return errors;
}

async function readOwner(
	context: VideoScenarioSourceContext,
	id: string
): Promise<ComponentManifest | null> {
	if (!context.owners.has(id))
		context.owners.set(
			id,
			readSource(context, `specification/units/${id}.json`)
				.then((text) => JSON.parse(text) as ComponentManifest)
				.catch(() => null)
		);
	return context.owners.get(id)!;
}

async function checkPath(
	context: VideoScenarioSourceContext,
	path: string,
	scenario: string,
	errors: string[]
): Promise<void> {
	try {
		await boundPath(context, path);
	} catch (error) {
		errors.push(`${scenario}: ${errorMessage(error)}`);
	}
}

async function readSource(context: VideoScenarioSourceContext, path: string): Promise<string> {
	if (!context.texts.has(path))
		context.texts.set(
			path,
			boundPath(context, path).then(() => context.tree.read(path))
		);
	return context.texts.get(path)!;
}

async function boundPath(context: VideoScenarioSourceContext, path: string): Promise<void> {
	if (!context.bounds.has(path)) context.bounds.set(path, admitBoundPath(context, path));
	return context.bounds.get(path)!;
}

async function admitBoundPath(context: VideoScenarioSourceContext, path: string): Promise<void> {
	if (
		!path ||
		path.startsWith('/') ||
		path.includes('\\') ||
		path.includes(':') ||
		path.split('/').some((part) => !part || part === '.' || part === '..')
	)
		throw new ExpectedCliError(`Unsafe video source binding ${path}`);
	if (!context.paths.has(path)) throw new ExpectedCliError(`Missing video source binding ${path}`);
	if (!context.root) return;
	const resolved = await realpath(join(context.root, path)),
		bound = relative(context.root, resolved);
	if (bound === '..' || bound.startsWith(`..${sep}`))
		throw new ExpectedCliError(`Video source binding escapes source root: ${path}`);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unreadable video source binding';
}
