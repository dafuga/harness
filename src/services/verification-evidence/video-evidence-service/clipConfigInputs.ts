// @harness-uid u_nfctcgnv7g
import ts from 'typescript';
import { posix } from 'node:path';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { clipDigest, clipWorkspace, readClipInput } from './clipInputFiles';
import type { ClipInputContext, ClipInputReferences } from './clipInputs.types';

/** Follow literal JSON config inheritance without executing or reading generated configuration. */
export function clipConfigInputs(context: ClipInputContext, path: string): ClipInputReferences {
	if (!/(?:^|\/)(?:tsconfig|jsconfig)(?:\.[^/]+)?\.json$/.test(path))
		return { paths: [], reasons: [] };
	return configurationInputs(context, path, new Set());
}

function configurationInputs(
	context: ClipInputContext,
	path: string,
	active: Set<string>
): ClipInputReferences {
	context.configurations ??= new Map();
	const cached = context.configurations.get(path);
	if (cached) return cached;
	if (active.has(path)) throw new ExpectedCliError(`Video config extends cycle at ${path}`);
	active.add(path);
	try {
		const value = configurationExtends(context, path);
		const parents: unknown[] = configurationParents(value);
		const result = { paths: [] as string[], reasons: [] as string[] };
		for (const parent of parents) {
			const inputs = parentInputs(context, path, parent, active);
			result.paths.push(...inputs.paths);
			result.reasons.push(...inputs.reasons);
		}
		const unique = { paths: [...new Set(result.paths)], reasons: [...new Set(result.reasons)] };
		context.configurations.set(path, unique);
		return unique;
	} finally {
		active.delete(path);
	}
}

function configurationExtends(context: ClipInputContext, path: string): unknown {
	const input = readClipInput(context, path);
	if (!input.text && input.sha256 !== clipDigest(''))
		throw new ExpectedCliError(`Invalid binary video JSON configuration ${path}`);
	const parsed = ts.parseConfigFileTextToJson(path, input.text);
	if (
		parsed.error ||
		!parsed.config ||
		typeof parsed.config !== 'object' ||
		Array.isArray(parsed.config)
	)
		throw new ExpectedCliError(`Invalid video JSON configuration ${path}`);
	return Object.hasOwn(parsed.config, 'extends') ? parsed.config.extends : undefined;
}

function parentInputs(
	context: ClipInputContext,
	from: string,
	reference: unknown,
	active: Set<string>
): ClipInputReferences {
	if (typeof reference !== 'string') return uncertainExtends(from, 'non-literal');
	const requested = configurationTarget(from, reference);
	const target = requested ? configurationFile(context, requested) : undefined;
	if (!target) return uncertainExtends(from, 'package');
	if (
		/(?:^|\/)(?:\.svelte-kit|\.cache|\.generated|generated|node_modules|dist|build|output)\//.test(
			target
		)
	)
		return generatedInputs(context, from, target);
	if (!context.paths.has(target))
		throw new ExpectedCliError(`Missing video config extends binding ${target}`);
	if (!target.endsWith('.json')) return uncertainExtends(from, 'unsupported configuration format');
	const parent = configurationInputs(context, target, active);
	return { paths: [target, ...parent.paths], reasons: parent.reasons };
}

function configurationTarget(from: string, reference: string): string | undefined {
	if (unsafeReference(reference))
		throw new ExpectedCliError(`Unsafe or private video config extends binding in ${from}`);
	if (!/^\.{1,2}\//.test(reference)) return undefined;
	const target = posix.join(posix.dirname(from), reference);
	if (target === '..' || target.startsWith('../'))
		throw new ExpectedCliError(`Video config extends binding escapes source root: ${from}`);
	return target;
}

function uncertainExtends(path: string, kind: string): ClipInputReferences {
	return {
		paths: [],
		reasons: [`Unproven ${kind} extends in ${path}; widened to source snapshot; recording required`]
	};
}

function generatedInputs(
	context: ClipInputContext,
	from: string,
	target: string
): ClipInputReferences {
	const workspace = clipWorkspace(context, from);
	if (
		target !== posix.join(workspace, '.svelte-kit/tsconfig.json') ||
		!lockedSvelteKitProducer(context, workspace)
	)
		return uncertainExtends(from, 'generated configuration');
	return {
		paths: [],
		reasons: [
			`Known SvelteKit sync producer for ${target}; widened to tracked producer source, configuration and lockfiles; runtime ${process.versions.bun ?? process.version}`
		]
	};
}

function lockedSvelteKitProducer(context: ClipInputContext, workspace: string): boolean {
	const path = posix.join(workspace, 'package.json');
	if (!context.paths.has(path)) return false;
	const pkg = JSON.parse(readClipInput(context, path).text) as {
		scripts?: Record<string, string>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	return Boolean(
		(pkg.dependencies?.['@sveltejs/kit'] ?? pkg.devDependencies?.['@sveltejs/kit']) &&
		Object.values(pkg.scripts ?? {}).some((script) => /\bsvelte-kit\s+sync\b/.test(script)) &&
		['svelte.config.js', 'svelte.config.ts'].some((name) =>
			context.paths.has(posix.join(workspace, name))
		) &&
		['bun.lock', 'bun.lockb', 'yarn.lock', 'package-lock.json'].some((name) =>
			context.paths.has(name)
		)
	);
}

function configurationParents(value: unknown): unknown[] {
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

function unsafeReference(reference: string): boolean {
	return (
		!reference ||
		/^(?:\/|[a-zA-Z]:)|\\/.test(reference) ||
		[...reference].some((character) => character.charCodeAt(0) < 32) ||
		/(?:^|\/)\.env(?:\.local)?$/.test(reference)
	);
}

function configurationFile(context: ClipInputContext, target: string): string {
	return target.endsWith('.json') || context.paths.has(target) ? target : `${target}.json`;
}
