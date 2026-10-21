import { expect, test } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
const cli = resolve('src/index.ts');

test.each(['2d', '3d'])(
	'CLI creates %s games and supports app and game generators',
	async (dimension) => {
		const root = await mkdtemp(join(tmpdir(), 'harness-game-cli-'));
		try {
			execFileSync('bun', [cli, 'new', 'game', 'adventure', '--dimension', dimension], {
				cwd: root
			});
			const cwd = join(root, 'adventure');
			const manifest = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
			expect(manifest.harness).toEqual({ kind: 'game', dimension, aiRendering: false });
			await playableRoute(cwd);
			for (const [kind, name] of [
				['view', 'inventory'],
				['game-view', 'battle'],
				['mechanic', 'combat'],
				['checkpoint', 'victory']
			]) {
				execFileSync('bun', [cli, 'generate', kind, name], { cwd });
			}
			expect(await readFile(join(cwd, 'src/routes/inventory/+page.svelte'), 'utf8')).toContain(
				'Inventory'
			);
			expect(await readFile(join(cwd, 'src/utils/combat.ts'), 'utf8')).toContain(
				'Readonly<GameState>'
			);
			expect(await readFile(join(cwd, 'src/config/victoryCheckpointConfig.ts'), 'utf8')).toContain(
				'victory'
			);
			expect(() =>
				execFileSync('bun', [cli, 'new', 'game', 'bad', '--dimension', '4d'], {
					cwd: root,
					stdio: 'pipe'
				})
			).toThrow();
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	},
	120_000
);

async function playableRoute(cwd: string) {
	execFileSync('bun', ['install', '--backend=copyfile'], { cwd, stdio: 'pipe' });
	const server = spawn(
		process.execPath,
		['node_modules/vite/bin/vite.js', 'dev', '--host', '127.0.0.1', '--port', '0'],
		{ cwd, stdio: ['ignore', 'pipe', 'pipe'] }
	);
	try {
		const url = await new Promise<string>((resolveUrl, reject) => {
			const timeout = setTimeout(() => reject(new Error('Generated game did not start')), 30_000);
			server.once('exit', () => {
				clearTimeout(timeout);
				reject(new Error('Generated game exited'));
			});
			server.once('error', reject);
			server.stdout.on('data', (chunk) => {
				const address = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
				if (address) {
					clearTimeout(timeout);
					resolveUrl(address);
				}
			});
		});
		const response = await fetch(url + '/game');
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('<canvas');
		const reopened = await fetch(url + '/game');
		expect(await reopened.text()).toContain('<canvas');
	} finally {
		server.kill();
		await new Promise<void>((resolveExit) => server.once('exit', () => resolveExit()));
	}
}

test('game-only generators reject apps before creating broken imports', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-app-no-game-'));
	try {
		execFileSync('bun', [cli, 'new', 'app', 'app'], { cwd: root });
		expect(() =>
			execFileSync('bun', [cli, 'generate', 'mechanic', 'movement'], {
				cwd: join(root, 'app'),
				stdio: 'pipe'
			})
		).toThrow();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
