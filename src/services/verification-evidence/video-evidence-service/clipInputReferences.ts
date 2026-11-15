// @harness-uid u_nfctcgnv7g
import { posix } from 'node:path';
import { builtinModules } from 'node:module';
import { scanImports } from '../../../utils/development-tooling/scanImports';
import { resolveImport } from '../../../utils/development-tooling/resolveImport';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { clipWorkspace, readClipInput } from './clipInputFiles';
import type {
	SourceReference,
	SourceLanguage
} from '../../../utils/development-tooling/scanImports.types';
import type { ClipInputContext } from './clipInputs.types';

/** Resolve committed imports, local API calls, style URLs and literal media bindings. */
export function clipInputReferences(context: ClipInputContext, path: string) {
	const cached = context.references.get(path);
	if (cached) return cached;
	const code = readClipInput(context, path).text,
		language = inputLanguage(path);
	const references = scanImports(code, language),
		paths: string[] = [],
		reasons: string[] = [];
	if (language === 'svelte')
		for (const style of code.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g))
			references.push(...scanImports(style[1], 'css'));
	for (const reference of references) {
		const resolved = resolveClipReference(context, path, reference);
		paths.push(...resolved.paths);
		reasons.push(...resolved.reasons);
	}
	paths.push(...assetInputs(context, path, code, reasons));
	const result = { paths: [...new Set(paths)], reasons: [...new Set(reasons)] };
	context.references.set(path, result);
	return result;
}

function assetInputs(
	context: ClipInputContext,
	path: string,
	code: string,
	reasons: string[]
): string[] {
	const styles = path.endsWith('.css')
		? code
		: [...code.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]).join('\n');
	const urls = [...styles.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)].map((match) => match[2]);
	if (/url\(\s*(?:var\(|\{)|\bnew\s+URL\(\s*[^'"\s]/.test(styles))
		reasons.push(`Dynamic style dependency in ${path}; widened to source snapshot`);
	if (path.endsWith('.svelte') || path.endsWith('.html')) {
		urls.push(
			...[...code.matchAll(/\b(?:src|poster)\s*=\s*(['"])(.*?)\1/g)].map((match) => match[2])
		);
		urls.push(
			...[...code.matchAll(/<(?:link|use|image)\b[^>]*\bhref\s*=\s*(['"])(.*?)\1/g)].map(
				(match) => match[2]
			)
		);
		if (/\b(?:src|poster|srcset)\s*=\s*\{|\bsrcset\s*=|url\(\s*(?:var\(|\{)/.test(code))
			reasons.push(`Dynamic asset dependency in ${path}; widened to source snapshot`);
	}
	return urls.flatMap((url) => localAsset(context, path, url, reasons));
}

function localAsset(
	context: ClipInputContext,
	path: string,
	url: string,
	reasons: string[]
): string[] {
	if (/^(?:data:|#)/.test(url)) return [];
	if (/^(?:[a-z]+:|\/\/)/i.test(url)) {
		reasons.push(
			`External asset ${url} in ${path}; widened to source snapshot; recording required`
		);
		return [];
	}
	const clean = url.split(/[?#]/)[0],
		workspace = clipWorkspace(context, path);
	const target = url.startsWith('/')
		? posix.join(workspace, 'static', clean)
		: posix.join(posix.dirname(path), clean);
	if (!context.paths.has(target))
		throw new ExpectedCliError(`Missing video asset ${url} in ${path}`);
	return [target];
}

function localPackageInputs(
	context: ClipInputContext,
	name: string,
	reasons: string[],
	from: string
): string[] {
	if (/^(?:node:|bun:)/.test(name) || builtinModules.includes(name)) return [];
	context.packages ??= packageBindings(context);
	const path = context.packages.get(name);
	if (!path) {
		if (!declaredPackage(context, from, name))
			reasons.push(
				`Unbound package or alias ${name} in ${from}; widened to source snapshot; recording required`
			);
		return [];
	}
	reasons.push(
		`Workspace package ${name} export resolution in ${posix.dirname(path)}; widened to source snapshot`
	);
	return [path];
}

function declaredPackage(context: ClipInputContext, from: string, name: string): boolean {
	const manifests = new Set([
		posix.join(clipWorkspace(context, from), 'package.json'),
		'package.json'
	]);
	return [...manifests].some((path) => {
		if (!context.paths.has(path)) return false;
		const declared = JSON.parse(readClipInput(context, path).text) as Record<
			string,
			Record<string, string>
		>;
		return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].some(
			(key) => Object.hasOwn(declared[key] ?? {}, name)
		);
	});
}

function packageBindings(context: ClipInputContext): Map<string, string> {
	const packages = new Map<string, string>();
	for (const path of context.paths) {
		if (!path.endsWith('/package.json')) continue;
		const declared = JSON.parse(readClipInput(context, path).text) as { name?: string };
		if (declared.name) packages.set(declared.name, path);
	}
	return packages;
}

function inputLanguage(path: string): SourceLanguage {
	if (path.endsWith('.svelte')) return 'svelte';
	if (path.endsWith('.css')) return 'css';
	if (/\.[cm]?[jt]sx?$/.test(path)) return 'ts';
	return 'other';
}

function resolveClipReference(context: ClipInputContext, path: string, reference: SourceReference) {
	const resolved = resolveImport(path, reference, {
		files: context.paths,
		workspaceRoot: clipWorkspace(context, path)
	});
	const paths: string[] = [],
		reasons: string[] = [];
	if (resolved.path) return { paths: [resolved.path], reasons };
	if (reference.via === 'http' && resolved.external) {
		reasons.push(
			`Unbound external API ${resolved.external} in ${path}; widened to source snapshot; recording required`
		);
		return { paths, reasons };
	}
	if (resolved.uncertain) {
		assertResolvable(path, reference);
		reasons.push(
			`Uncertain ${reference.via} dependency in ${path}: ${resolved.uncertain.detail}; widened to source snapshot`
		);
		return { paths, reasons };
	}
	if (resolved.external === 'sveltekit') return { paths, reasons };
	if (unknownAlias(reference))
		reasons.push(`Unknown alias ${reference.specifier} in ${path}; widened to source snapshot`);
	else if (resolved.external && !reference.typeOnly)
		paths.push(...localPackageInputs(context, resolved.external, reasons, path));
	return { paths, reasons };
}

function unknownAlias(reference: SourceReference): boolean {
	return Boolean(
		reference.specifier?.startsWith('$') &&
		!/^\$(app|env|service-worker)\b/.test(reference.specifier)
	);
}

function assertResolvable(path: string, reference: SourceReference): void {
	if (reference.specifier && reference.via !== 'http')
		throw new ExpectedCliError(`Unresolved video input ${reference.specifier} in ${path}`);
}
