// @harness-uid u_nfctcgnv7g
import { clipRuntimeInputs } from './clipGeneratedInputs';
import { posix } from 'node:path';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { clipWorkspace, readClipInput } from './clipInputFiles';
import { clipInputReferences } from './clipInputReferences';
import type { VideoClip } from '../../../utils/verification-evidence/videoClipSchema.types';
import type { ClipInputClosure, ClipInputContext, VideoOwner } from './clipInputs.types';

export function clipInputClosure(context: ClipInputContext, clip: VideoClip): ClipInputClosure {
	const cached = context.closures.get(clip.id);
	if (cached) return cached;
	const closure: ClipInputClosure = { files: new Set(), contracts: new Map(), reasons: new Set() };
	const pending = [...clip.inputs, clip.script.path, clip.fixture];
	for (const path of pending) readClipInput(context, path);
	addOwner(context, closure, clip.unit, pending);
	addRecorder(context, closure, pending);
	while (pending.length) {
		const path = pending.pop()!;
		if (closure.files.has(path)) continue;
		readClipInput(context, path);
		closure.files.add(path);
		for (const owner of context.sourceOwners.get(path) ?? [])
			addOwner(context, closure, owner, pending);
		const references = clipInputReferences(context, path);
		pending.push(...references.paths, ...ambientInputs(context, path));
		for (const reason of references.reasons) closure.reasons.add(reason);
	}
	if (closure.reasons.size)
		for (const path of context.paths) {
			readClipInput(context, path);
			closure.files.add(path);
		}
	context.closures.set(clip.id, closure);
	return closure;
}

function addRecorder(
	context: ClipInputContext,
	closure: ClipInputClosure,
	pending: string[]
): void {
	for (const [name, id, uid] of [
		[
			'NativeVideoRecorderService',
			'service.verification-evidence-native-video-recorder',
			'u_akqk4uwm6b'
		],
		['VideoCaptureService', 'service.verification-evidence-video-capture', 'u_2eznkaf4qv']
	]) {
		if (!context.paths.has(`src/services/verification-evidence/${name}.ts`)) continue;
		if (context.owners.get(id)?.uid !== uid)
			throw new ExpectedCliError(`Missing registered video recording recipe binding: ${id}`);
		addOwner(context, closure, id, pending);
	}
}

function addOwner(
	context: ClipInputContext,
	closure: ClipInputClosure,
	id: string,
	pending: string[]
): void {
	if (closure.contracts.has(id)) return;
	const owner = context.owners.get(id);
	if (owner?.status !== 'active') throw new ExpectedCliError(`Missing active video owner ${id}`);
	if (!owner.owns.source.length)
		throw new ExpectedCliError(`Missing video source bindings for ${id}`);
	closure.contracts.set(id, owner);
	pending.push(...owner.owns.source);
	for (const entry of runtimeInputs(owner)) {
		const runtime = clipRuntimeInputs(context, owner, entry);
		pending.push(...runtime.paths);
		for (const reason of runtime.reasons) closure.reasons.add(reason);
	}
	for (const dependency of owner.dependencies) addOwner(context, closure, dependency.unit, pending);
}

function ambientInputs(context: ClipInputContext, path: string): string[] {
	const workspace = clipWorkspace(context, path);
	const configs = [
		'package.json',
		'tsconfig.json',
		'jsconfig.json',
		'svelte.config.js',
		'svelte.config.ts',
		'vite.config.ts',
		'vite.config.js',
		'playwright.config.ts',
		'postcss.config.js',
		'tailwind.config.ts'
	];
	const inputs = [
		...configs.map((name) => posix.join(workspace, name)),
		...configs,
		'bun.lock',
		'yarn.lock',
		'package-lock.json',
		'harness.verify.json'
	];
	if (path.startsWith(posix.join(workspace, 'src') + '/'))
		inputs.push(
			...[
				'app.css',
				'global.css',
				'styles.css',
				'app.html',
				'hooks.client.ts',
				'hooks.server.ts',
				'hooks.ts'
			].map((name) => posix.join(workspace, 'src', name))
		);
	inputs.push(...routeInputs(workspace, path));
	return inputs.filter((input) => context.paths.has(input));
}

function routeInputs(workspace: string, path: string): string[] {
	const inputs: string[] = [];
	const routes = posix.join(workspace, 'src/routes');
	if (path.startsWith(routes + '/')) {
		let directory = posix.dirname(path);
		while (directory.startsWith(routes)) {
			inputs.push(
				...[
					'+layout.svelte',
					'+layout.ts',
					'+layout.js',
					'+layout.server.ts',
					'+layout.server.js'
				].map((name) => posix.join(directory, name))
			);
			if (directory === routes) break;
			directory = posix.dirname(directory);
		}
		inputs.push(
			...['+page.ts', '+page.js', '+page.server.ts', '+page.server.js'].map((name) =>
				posix.join(posix.dirname(path), name)
			)
		);
	}
	return inputs;
}

function runtimeInputs(owner: VideoOwner): string[] {
	return [
		owner.runtime?.entry,
		...(owner.runtime?.targets ?? []).map((target) => target.entry)
	].filter((entry): entry is string => typeof entry === 'string');
}
