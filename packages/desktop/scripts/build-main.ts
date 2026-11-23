// @harness-uid u_l6w3l34t4a
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ExpectedCliError } from '../../../src/core/development-tooling/errors';
const jsoncParser: Bun.BunPlugin = {
	name: 'bundle-jsonc-parser-module',
	setup(build) {
		build.onResolve({ filter: /^jsonc-parser$/ }, () => ({
			path: Bun.resolveSync('jsonc-parser/lib/esm/main.js', import.meta.dir)
		}));
	}
};
export const desktopNodeOptions = {
	target: 'node' as const,
	format: 'cjs' as const,
	external: ['electron', 'playwright-core'],
	plugins: [jsoncParser],
	outdir: 'dist',
	sourcemap: 'external' as const
};

const releaseOriginVariable = 'HARNESS_RELEASE_HUB_ORIGIN';
const releaseOriginDefine = 'process.env.HARNESS_HUB_ORIGIN';

/**
 * Compile the configured Hub into the main bundle. Development builds may defer to their
 * runtime environment. Packaging requires the release setting before staging a bundle.
 */
export function releaseDefine(
	env: Record<string, string | undefined>,
	required = false
): Record<string, string> {
	const origin = env[releaseOriginVariable];
	if (origin === undefined && required)
		throw new ExpectedCliError(`${releaseOriginVariable} is required for Mac release packaging.`);
	if (origin === undefined) return {};
	return { [releaseOriginDefine]: JSON.stringify(canonicalHubOrigin(origin)) };
}

/** Accepts only `https://host[:port]` exactly as written, with a public, dotted host name. */
function canonicalHubOrigin(value: string): string {
	const url = parseUrl(value);
	if (!url || url.protocol !== 'https:' || url.origin !== value || isLocalOrPrivate(url.hostname)) {
		throw new ExpectedCliError(
			`${releaseOriginVariable} must be the exact https origin of the Hub: no path, userinfo, query, fragment, default port or uppercase host, and no loopback, private or single-label host`
		);
	}
	return value;
}

function parseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

/** Names and addresses that only this machine or a private network can reach. */
function isLocalOrPrivate(hostname: string): boolean {
	if (hostname.startsWith('[') || !hostname.includes('.')) return true;
	if (hostname.endsWith('.localhost')) return true;
	return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && isPrivateIPv4(hostname);
}

/**
 * Second-octet ranges per first octet: unspecified, loopback, carrier-grade NAT, link-local and
 * RFC 1918 addresses.
 */
const privateIPv4Blocks = new Map<number, readonly [number, number]>([
	[0, [0, 255]],
	[10, [0, 255]],
	[100, [64, 127]],
	[127, [0, 255]],
	[169, [254, 254]],
	[172, [16, 31]],
	[192, [168, 168]]
]);

function isPrivateIPv4(address: string): boolean {
	const [first, second] = address.split('.').map(Number);
	const range = privateIPv4Blocks.get(first);
	return range !== undefined && second >= range[0] && second <= range[1];
}

export async function buildDesktopMain(
	define: Record<string, string>,
	outdir: string = desktopNodeOptions.outdir
) {
	await mkdir(outdir, { recursive: true });
	const targets = [
		{ entry: 'src/initializers/initializeDesktop.ts', out: 'main.cjs', define },
		{ entry: 'src/initializers/initializePreload.ts', out: 'preload.cjs', define: {} }
	];
	for (const { entry, out, define: targetDefine } of targets) {
		const result = await Bun.build({
			...desktopNodeOptions,
			entrypoints: [entry],
			naming: out,
			outdir,
			define: targetDefine
		});
		if (!result.success) throw new ExpectedCliError(result.logs.map(String).join('\n'));
		execFileSync('node', ['--check', join(outdir, out)], { stdio: 'inherit' });
	}
}
if (import.meta.main) await buildDesktopMain(releaseDefine(process.env));
