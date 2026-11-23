import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const desktopRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const origin = 'https://hub.example.invalid';

/**
 * Runs the real build-main script in a temporary workspace whose scripts, src and node_modules
 * link to this package, so the release outputs land in that workspace and never in the worktree.
 */
async function runReleaseBuild(releaseOrigin: string | undefined) {
	const workspace = await mkdtemp(join(tmpdir(), 'harness-hub-origin-'));
	for (const name of ['scripts', 'src']) {
		await symlink(join(desktopRoot, name), join(workspace, name));
	}
	await symlink(join(repositoryRoot, 'node_modules'), join(workspace, 'node_modules'));
	const env: Record<string, string> = {
		PATH: process.env.PATH ?? '',
		HOME: process.env.HOME ?? ''
	};
	if (releaseOrigin !== undefined) env.HARNESS_RELEASE_HUB_ORIGIN = releaseOrigin;
	const result = spawnSync('bun', ['scripts/build-main.ts'], {
		cwd: workspace,
		env,
		encoding: 'utf8'
	});
	return { workspace, result };
}

test('a set release origin is compiled into the main bundle and not the preload', async () => {
	const { workspace, result } = await runReleaseBuild(origin);
	try {
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
		const main = await readFile(join(workspace, 'dist/main.cjs'), 'utf8');
		const preload = await readFile(join(workspace, 'dist/preload.cjs'), 'utf8');
		expect(main).toContain(JSON.stringify(origin));
		expect(main).not.toContain('process.env.HARNESS_HUB_ORIGIN');
		expect(preload).not.toContain(origin);
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
}, 120000);

test('an absent release origin keeps the runtime override and bundles no origin', async () => {
	const { workspace, result } = await runReleaseBuild(undefined);
	try {
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
		const main = await readFile(join(workspace, 'dist/main.cjs'), 'utf8');
		expect(main).toContain('process.env.HARNESS_HUB_ORIGIN');
		expect(main).not.toContain(origin);
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
}, 120000);

test.each([
	['an empty value', ''],
	['plain HTTP', 'http://hub.example.invalid'],
	['a trailing slash', 'https://hub.example.invalid/'],
	['a path', 'https://hub.example.invalid/api'],
	['a query', 'https://hub.example.invalid?tenant=1'],
	['a fragment', 'https://hub.example.invalid#top'],
	['userinfo', 'https://user@hub.example.invalid'],
	['an uppercase host', 'https://Hub.example.invalid'],
	['an explicit default port', 'https://hub.example.invalid:443'],
	['a localhost name', 'https://localhost'],
	['a loopback address', 'https://127.0.0.1'],
	['a private address', 'https://10.0.0.5'],
	['a link-local IPv6 address', 'https://[fe80::1]'],
	['a value without a scheme', 'hub.example.invalid']
])(
	'a release build with %s fails before writing any output',
	async (_label, value) => {
		const { workspace, result } = await runReleaseBuild(value);
		try {
			expect(result.status).not.toBe(0);
			expect(result.stderr).toContain('HARNESS_RELEASE_HUB_ORIGIN');
			await expect(access(join(workspace, 'dist'))).rejects.toThrow();
		} finally {
			await rm(workspace, { recursive: true, force: true });
		}
	},
	120000
);

test.runIf(process.platform === 'darwin')(
	'iOS Release selects the production Hub and refuses missing or invalid build settings',
	() => {
		const project = join(desktopRoot, 'ios/App/App.xcodeproj/project.pbxproj');
		const plist = spawnSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', project], {
			encoding: 'utf8'
		});
		expect(plist.status, plist.stderr).toBe(0);
		const { objects } = JSON.parse(plist.stdout);
		const target = Object.values(objects).find(
			(entry) => (entry as { isa?: string }).isa === 'PBXNativeTarget'
		) as { buildConfigurationList: string; buildPhases: string[] };
		const configurations: string[] = objects[target.buildConfigurationList].buildConfigurations;
		const release = configurations
			.map((id) => objects[id])
			.find((config) => config.name === 'Release');
		const production = 'https://dafuga-harness.pages.dev';
		expect(release.buildSettings.HARNESS_HUB_ORIGIN).toBe(production);
		const phase = target.buildPhases
			.map((id) => objects[id])
			.find((entry) => entry.name === 'Validate Harness Hub origin');
		expect(phase?.shellScript).toBeTruthy();
		const run = (configuration: string, value?: string) =>
			spawnSync(phase.shellPath, ['-c', phase.shellScript], {
				encoding: 'utf8',
				env: { CONFIGURATION: configuration, HARNESS_HUB_ORIGIN: value }
			});
		expect(run('Debug').status).toBe(0);
		expect(run('Release', production).status).toBe(0);
		for (const invalid of [undefined, '', 'http://hub.example.invalid', production + '/sign-in']) {
			const result = run('Release', invalid);
			expect(result.status).not.toBe(0);
			expect(result.stderr).toContain('HARNESS_HUB_ORIGIN');
		}
	}
);
