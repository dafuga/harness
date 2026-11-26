import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';
import { releaseDefine } from '../../../../desktop/scripts/build-main';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const releaseExample = 'https://hub.example.com';

/**
 * What packaging compiles into the Mac app, taken from the release build itself, with this
 * chain's Hub where the release Hub goes.
 */
function packagedDefine(origin: string) {
	const define = releaseDefine({ HARNESS_RELEASE_HUB_ORIGIN: releaseExample }, true);
	return Object.fromEntries(
		Object.entries(define).map(([name, value]) => [
			name,
			value === JSON.stringify(releaseExample) ? JSON.stringify(origin) : value
		])
	);
}

/**
 * An app opened from Finder gets the login session's environment: no HARNESS_ variable at all,
 * so no publisher or other opt-in is on.
 */
export function installedLaunchEnvironment(home: string) {
	return { HOME: home, TMPDIR: home, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' };
}

const replaced: Plugin = {
	name: 'installed-chain-stand-ins',
	setup(bundle) {
		bundle.onResolve({ filter: /^electron$/ }, () => ({ path: source('./macElectron.ts') }));
		bundle.onResolve({ filter: /\/liveQuotaSources$/ }, () => ({
			path: source('./macQuotaSources.ts')
		}));
	}
};

async function compile(outfile: string, origin: string) {
	await build({
		entryPoints: [source('./macMain.ts')],
		outfile,
		bundle: true,
		platform: 'node',
		format: 'cjs',
		external: ['playwright-core'],
		mainFields: ['module', 'main'],
		alias: { $reports: source('../../../../reports/src') },
		define: packagedDefine(origin),
		plugins: [replaced],
		logLevel: 'silent'
	});
}

/** The installed Mac app, already signed in, as its own process. */
export async function startChainMac(origin: string, trackerOrigin: string) {
	const home = await mkdtemp(join(tmpdir(), 'hub-chain-mac-'));
	const profile = join(home, 'profile');
	await mkdir(profile);
	const session = { origin, principalId: 'google:fixture-owner', token: 'session-owner' };
	await writeFile(join(profile, 'session.enc'), JSON.stringify(session));
	const main = join(home, 'main.cjs');
	await compile(main, origin);
	const child = spawn(process.execPath, [main, trackerOrigin, profile], {
		cwd: home,
		env: installedLaunchEnvironment(home),
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let output = '';
	for (const stream of [child.stdout, child.stderr])
		stream.on('data', (chunk) => (output = (output + chunk).slice(-4000)));
	const exited = once(child, 'exit');
	return {
		output: () => output,
		async stop() {
			if (child.exitCode === null && child.signalCode === null) {
				child.kill('SIGKILL');
				await exited;
			}
			await rm(home, { recursive: true, force: true });
		}
	};
}
