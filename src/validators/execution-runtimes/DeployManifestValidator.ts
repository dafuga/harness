// @harness-uid u_ckez8zqasf
import { constants, accessSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import {
	digest,
	hash,
	name,
	pathFromRoot,
	profile,
	reference
} from '../../core/execution-runtimes/scripted-deploy/contracts';

const absolute = z.string().refine(isAbsolute);
const image = z.string().regex(/^(?:sha256:[a-f0-9]{64}|[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64})$/);
const target = z.strictObject({ id: reference, route: z.url().startsWith('https://'), profile });
const script = pathFromRoot.refine((value) => value.startsWith('scripts/'));
const project = z.strictObject({
	repository: z.string().regex(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/),
	checkout: absolute,
	sourceRef: z.string().regex(/^refs\/heads\/[\w/-]+$/),
	image,
	root: absolute,
	toolchain: z.strictObject({
		node: reference,
		bun: reference,
		wrangler: reference,
		gcloud: reference
	}),
	scripts: z.strictObject({
		build: script,
		inspect: script,
		deploy: script,
		smoke: script,
		rollback: script,
		cleanup: script
	}),
	targets: z.strictObject({ staging: target, preprod: target.optional(), prod: target.optional() }),
	differences: z.record(
		z.string().regex(/^(bindings|secretNames|migrations|runtimes|flags)\.[\w.:-]+$/),
		z.string().trim().min(1).max(240)
	),
	item: reference
});
const issuer = z.strictObject({ id: reference, publicKey: z.string().min(32).max(256) });
const registry = z
	.strictObject({
		schema: z.literal(1),
		state: absolute,
		broker: absolute,
		tracker: absolute,
		reviewers: z.array(issuer).min(1),
		stageAuthority: issuer,
		daniel: issuer,
		projects: z.record(name, project)
	})
	.refine(({ reviewers, stageAuthority, daniel }) => {
		const issuers = [...reviewers, stageAuthority, daniel];
		return (
			new Set(issuers.map(({ id }) => id)).size === issuers.length &&
			new Set(issuers.map(({ publicKey }) => publicKey)).size === issuers.length
		);
	}, 'Approval and reviewer keys must be distinct.');

export type DeployRegistry = z.infer<typeof registry>;
export type DeployProject = z.infer<typeof project>;

export class DeployManifestValidator {
	read(file: string): DeployRegistry {
		const input = privateFile(file);
		const result = registry.safeParse(readJson(input));
		if (!result.success)
			throw new Error(
				'Invalid deploy registry: ' +
					result.error.issues.map((issue) => issue.path.join('.')).join(', ')
			);
		checkExecutable(result.data.broker);
		checkExecutable(result.data.tracker);
		return result.data;
	}
}

export function privateFile(path: string): string {
	const file = resolve(path);
	const stat = lstatSync(file);
	if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) {
		throw new Error('Deployment control files must be regular, owner-only files.');
	}
	return file;
}

function checkExecutable(file: string): void {
	const details = statSync(file);
	if (
		!details.isFile() ||
		(details.mode & 0o022) !== 0 ||
		![0, process.getuid?.()].includes(details.uid)
	) {
		throw new Error('Invalid deployment control executable.');
	}
	accessSync(file, constants.X_OK);
}

export function readJson(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch {
		throw new Error('Invalid or missing deployment JSON.');
	}
}

export function scriptFile(root: string, path: string): string {
	const targetPath = resolve(realpathSync(root), pathFromRoot.parse(path));
	const file = realpathSync(targetPath);
	const inside = relative(realpathSync(root), file);
	if (
		file !== targetPath ||
		inside.startsWith('..') ||
		isAbsolute(inside) ||
		!lstatSync(file).isFile()
	) {
		throw new Error('Deployment scripts must be regular files within the reviewed adapter root.');
	}
	return file;
}

export function manifestDigest(config: DeployProject): string {
	const portable = { ...config, root: null, checkout: null };
	const scripts = Object.fromEntries(
		Object.entries(config.scripts).map(([phase, path]) => [
			phase,
			hash(readFileSync(scriptFile(config.root, path), 'utf8'))
		])
	);
	return digest.parse(hash({ config: portable, scripts }));
}
