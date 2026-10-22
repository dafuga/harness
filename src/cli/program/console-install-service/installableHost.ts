import type { HostRequest } from '../../../utils/development-tooling/installableHost';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';

const packageName = '@dafuga01/harness';

/** What a Worker script may weigh compressed: on the free plan, and on a paid one. */
const workerLimits = { free: 3, paid: 10 };

const mebibyte = 1024 * 1024;

/**
 * Stops an install that cannot be protected or understood: the directory must be a SvelteKit
 * project, and the policy must be a module the host already has that exports the named function.
 */
export async function installableHost(options: HostRequest): Promise<void> {
	requireHost(options.host);
	if (!/^\/[a-z0-9][a-z0-9-]*$/.test(options.base)) {
		fail('--base must be one path segment such as /harness.');
	}
	if (options.update && options.keep) fail('Choose --update or --keep, not both.');
	requireStorage(options);
	await requirePolicy(options);
}

/** Both names are written into generated code, so they must be plain names. */
function requireStorage(options: HostRequest): void {
	const { bucket, prefix } = options;
	if (bucket !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(bucket)) {
		fail('--bucket must be the name of a binding, such as HARNESS_HISTORY.');
	}
	if (prefix !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(prefix)) {
		fail('--prefix must be a plain path inside the bucket, such as history.');
	}
	if (prefix !== undefined && bucket === undefined) fail('--prefix needs --bucket.');
}

function requireHost(host: string): void {
	const configured = ['svelte.config.js', 'svelte.config.ts'].some((name) =>
		existsSync(join(host, name))
	);
	if (configured && existsSync(join(host, 'src/routes'))) return;
	fail(`${host} is not a SvelteKit project: it needs svelte.config.js and src/routes.`);
}

/** The policy is the host's own: it must already exist and export the named function. */
async function requirePolicy(options: HostRequest): Promise<void> {
	const { policy, policyExport: name } = options;
	if (!policy.startsWith('$lib/'))
		fail('--policy must name a module under $lib, such as $lib/server/harnessPolicy.');
	const stem = join(options.host, 'src/lib', policy.slice('$lib/'.length));
	const file = [`${stem}.ts`, `${stem}.js`, join(stem, 'index.ts'), join(stem, 'index.js')].find(
		(path) => existsSync(path)
	);
	if (!file) fail(`A host policy is required: ${policy} does not exist in ${options.host}.`);
	const source = await readFile(file, 'utf8');
	const declared = new RegExp(`export\\s+(?:async\\s+)?(?:const|function)\\s+${name}\\b`);
	const listed = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
	if (declared.test(source) || listed.test(source)) return;
	fail(`A host policy is required: ${policy} does not export ${name}.`);
}

/** What the host should know before it builds: a missing dependency, or too much bundled data. */
export async function hostWarnings(host: string, compressedBytes: number): Promise<string[]> {
	const found: string[] = [];
	const manifest = await readFile(join(host, 'package.json'), 'utf8').catch(() => '{}');
	const { dependencies = {}, devDependencies = {} } = JSON.parse(manifest) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	if (!(packageName in dependencies) && !(packageName in devDependencies)) {
		found.push(`${packageName} is not a dependency of the host yet; add it before building.`);
	}
	if (compressedBytes > workerLimits.free * mebibyte) {
		const size = (compressedBytes / mebibyte).toFixed(1);
		found.push(
			`The bundled history is ${size} MiB compressed; a Worker script may be ${workerLimits.free} MiB on the free plan and ${workerLimits.paid} MiB on a paid one. Keep it in a private bucket with --bucket <binding>.`
		);
	}
	return found;
}
