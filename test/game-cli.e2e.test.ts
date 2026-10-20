import { expect, test } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
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
			expect(manifest.harness).toEqual({ kind: 'game', dimension });
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
	}
);

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
