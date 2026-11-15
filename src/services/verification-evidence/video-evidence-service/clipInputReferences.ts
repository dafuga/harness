// @harness-uid u_nfctcgnv7g
import { clipGeneratedReference } from './clipGeneratedInputs';
import { clipConfigInputs } from './clipConfigInputs';
import { clipStyleInputs } from './clipStyleInputs';
import { clipAtomInputs } from './clipAtomInputs';
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
import type { ClipInputContext, ClipStyleInputs } from './clipInputs.types';

/** Resolve committed imports, local API calls, style URLs and literal media bindings. */
export function clipInputReferences(context: ClipInputContext, path: string) {
	const cached = context.references.get(path);
	if (cached) return cached;
	const code = readClipInput(context, path).text,
		language = inputLanguage(path);
	const styles = clipStyleInputs(path, code),
		config = clipConfigInputs(context, path);
	const scanned = scanImports(code, language),
		references = language === 'svelte' ? clipAtomInputs(code, scanned) : scanned,
		paths = [...config.paths],
		reasons = [...config.reasons, ...styles.reasons];
	if (language === 'svelte') references.push(...scanImports(styles.css, 'css'));
	for (const reference of references) {
		const resolved = resolveClipReference(context, path, reference);
		paths.push(...resolved.paths);
		reasons.push(...resolved.reasons);
	}
	paths.push(...assetInputs(context, path, styles, reasons));
	const result = { paths: [...new Set(paths)], reasons: [...new Set(reasons)] };
	context.references.set(path, result);
	return result;
}

function assetInputs(
	context: ClipInputContext,
	path: string,
	styles: ClipStyleInputs,
	reasons: string[]
): string[] {
	const urls = [...styles.css.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)].map(
		(match) => match[2]
	);
	if (/url\(\s*(?:var\(|\{)|\bnew\s+URL\(\s*[^'"\s]/.test(styles.css))
		reasons.push(`Dynamic style dependency in ${path}; widened to source snapshot`);
	if (path.endsWith('.svelte') || path.endsWith('.html')) {
		urls.push(
			...[...styles.markup.matchAll(/\b(?:src|poster)\s*=\s*(['"])(.*?)\1/g)].map(
				(match) => match[2]
			)
		);
		urls.push(
			...[...styles.markup.matchAll(/<(?:link|use|image)\b[^>]*\bhref\s*=\s*(['"])(.*?)\1/g)].map(
				(match) => match[2]
			)
		);
		if (/\b(?:src|poster|srcset)\s*=\s*\{|\bsrcset\s*=|url\(\s*(?:var\(|\{)/.test(styles.markup))
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
	const binding = url.replace(/^%sveltekit\.assets%(?=\/|$)/, '');
	const clean = binding.split(/[?#]/)[0],
		workspace = clipWorkspace(context, path);
	const target = binding.startsWith('/')
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
		const generated = clipGeneratedReference(context, path, reference);
		if (generated) return generated;
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
