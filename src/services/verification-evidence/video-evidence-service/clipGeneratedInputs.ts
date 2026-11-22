// @harness-uid u_nfctcgnv7g
import { posix } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { clipDigest, readClipInput } from './clipInputFiles';
import type { ClipInputContext, ClipInputReferences, VideoOwner } from './clipInputs.types';
import type { SourceReference } from '../../../utils/development-tooling/scanImports.types';

/** Only this registered output-directory binding has a reviewed frozen-build producer. */
export function clipGeneratedReference(
	context: ClipInputContext,
	from: string,
	reference: SourceReference
): ClipInputReferences | undefined {
	if (reference.via !== 'url' || !reference.specifier) return undefined;
	const target = posix.join(posix.dirname(from), reference.specifier).replace(/\/$/, '');
	if (
		!registeredSource(context, 'reports.function.e2e-fixtures', 'u_nsxu3st5to', from) ||
		target !== '.cache/reports-e2e'
	)
		return undefined;
	const paths = [
		'packages/reports/scripts/freeze-build.ts',
		'packages/reports/src/utils/development-tooling/frozenBuild.ts',
		'packages/reports/package.json',
		'bun.lock'
	];
	const producer = context.owners.get('reports.script.freeze-build');
	if (
		producer?.uid !== 'u_l3mlaqkhng' ||
		producer.status !== 'active' ||
		!paths.every((path) => context.paths.has(path))
	)
		return unprovenArtifact('frozen-build output directory');
	const recipe = readClipInput(context, paths[0]).text;
	if (!recipe.includes('frozenBuild(source, e2eFixtures().build)'))
		return unprovenArtifact('frozen-build output directory');
	return {
		paths,
		reasons: [
			`Known registered frozen-build output producer for ${target}; widened to tracked source/configuration/lockfiles; runtime ${runtimeVersion()}`
		]
	};
}

/** Generated executables are represented by their pinned producer, never by local output bytes. */
export function clipRuntimeInputs(
	context: ClipInputContext,
	owner: VideoOwner,
	entry: string
): ClipInputReferences {
	if (context.paths.has(entry)) return { paths: [entry], reasons: [] };
	if (
		owner.uid === 'u_nxqqbflvuc' &&
		['target/kernel/impact-kernel', 'target/kernel/impact-kernel.wasm'].includes(entry)
	)
		return kernelProducer(context, entry);
	if (
		owner.runtime?.targets?.some(
			(target) => target.entry === entry && ['wasm', 'process'].includes(target.kind ?? '')
		)
	)
		return unprovenArtifact(entry);
	throw new ExpectedCliError(`Missing video runtime source binding ${entry}`);
}

function kernelProducer(context: ClipInputContext, entry: string): ClipInputReferences {
	const paths = [
		'scripts/build-kernel/build-kernel.ts',
		'scripts/build-kernel/pinnedToolchain.ts',
		'rust-toolchain.toml',
		'Cargo.toml',
		'Cargo.lock'
	];
	const producer = context.owners.get('script.build-kernel');
	if (
		producer?.uid !== 'u_oh7ut73h75' ||
		producer.status !== 'active' ||
		!paths.every((path) => context.paths.has(path))
	)
		return unprovenArtifact(entry);
	const recipe = readClipInput(context, paths[0]).text;
	const pin = /^\s*channel\s*=\s*"(\d+\.\d+\.\d+)"/m.exec(
		readClipInput(context, 'rust-toolchain.toml').text
	)?.[1];
	if (!pin || !recipe.includes("const out = 'target/kernel'") || !recipe.includes("'--locked'"))
		return unprovenArtifact(entry);
	const optimizer = optimizerVersion(context);
	return {
		paths,
		reasons: [
			`Known pinned kernel output producer for ${entry}; rust ${pin}; optimizer ${optimizer}; widened to tracked source/configuration/lockfiles; runtime ${runtimeVersion()}${optimizer === 'unproven' ? '; recording required' : ''}`
		]
	};
}

function optimizerVersion(context: ClipInputContext): string {
	context.generatedVersions ??= new Map();
	const cached = context.generatedVersions.get('wasm-opt');
	if (cached) return cached;
	const tool = spawnSync('wasm-opt', ['--version'], {
		cwd: context.root,
		encoding: 'utf8',
		timeout: 5000,
		maxBuffer: 32768
	});
	let version = 'unproven';
	if (tool.status === 0) version = clipDigest(tool.stdout);
	else if (tool.error && 'code' in tool.error && tool.error.code === 'ENOENT')
		version = 'not-installed';
	context.generatedVersions.set('wasm-opt', version);
	return version;
}

function runtimeVersion(): string {
	return process.versions.bun ? `bun-${process.versions.bun}` : process.version;
}

function unprovenArtifact(entry: string): ClipInputReferences {
	return {
		paths: [],
		reasons: [
			`Unproven generated runtime binding ${entry}; widened to source snapshot; recording required`
		]
	};
}

function registeredSource(
	context: ClipInputContext,
	id: string,
	uid: string,
	path: string
): boolean {
	const owner = context.owners.get(id);
	return owner?.uid === uid && owner.status === 'active' && owner.owns.source.includes(path);
}
