import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../core/errors';

const packageName = '@dafuga01/harness';
/** Bundled media beyond this is likely to exceed what a Worker script may hold. */
const bundleWarningBytes = 5 * 1024 * 1024;

export interface HostRequest {
	host: string;
	policy: string;
	policyExport: string;
	base: string;
	update?: boolean;
	keep?: boolean;
}

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
	await requirePolicy(options);
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
export async function hostWarnings(host: string, bytes: number): Promise<string[]> {
	const found: string[] = [];
	const manifest = await readFile(join(host, 'package.json'), 'utf8').catch(() => '{}');
	const { dependencies = {}, devDependencies = {} } = JSON.parse(manifest) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	if (!(packageName in dependencies) && !(packageName in devDependencies)) {
		found.push(`${packageName} is not a dependency of the host yet; add it before building.`);
	}
	if (bytes > bundleWarningBytes) {
		const size = (bytes / 1024 / 1024).toFixed(1);
		found.push(
			`The index is ${size} MiB and is bundled into the server; a Worker script has a size limit, so serve large media from a protected binding by passing your own ConsoleData.`
		);
	}
	return found;
}
