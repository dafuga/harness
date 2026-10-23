import { expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { GameDocumentRepository } from '../packages/game/src/repositories/game-authoring/GameDocumentRepository';
import type { GameDocument } from '../packages/game/src/models/game-authoring/Game.types';
import { playableGame, gameCli } from './support/playableGame';
import { gameCommand, createGameWithCli, generateGamePieces } from './support/gameCommand';
const cli = resolve('src/index.ts');

test.each([
	['2d', 'source'],
	['3d', 'source'],
	['2d', 'bundled'],
	['3d', 'bundled']
])(
	'CLI creates %s games through %s and supports app and game generators',
	async (dimension, entry) => {
		const root = await mkdtemp(join(tmpdir(), 'harness-game-cli-'));
		try {
			const cli = gameCli(root, entry);
			createGameWithCli(cli, root, dimension, entry);
			const cwd = join(root, 'adventure');
			const manifest = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
			expect(manifest.harness).toEqual({ kind: 'game', dimension, aiRendering: false });
			await playableGame(cwd);
			generateGamePieces(cli, cwd, dimension, entry);
			const repository = new GameDocumentRepository(cwd);
			const saved = await repository.read();
			saved.document.views[0].title = 'Authored courtyard';
			await repository.save(saved.document, saved.revision);
			execFileSync('bun', ['run', 'check'], {
				cwd,
				stdio: 'pipe',
				env: { ...process.env, HARNESS_CLI_PATH: cli }
			});
			await invalidGames(cwd, saved.document);
			expect(await readFile(join(cwd, 'src/routes/inventory/+page.svelte'), 'utf8')).toContain(
				'Inventory'
			);
			expect(await readFile(join(cwd, 'src/utils/combat.ts'), 'utf8')).toContain(
				'Readonly<GameState>'
			);
			expect(await readFile(join(cwd, 'src/configs/victoryCheckpointConfig.ts'), 'utf8')).toContain(
				'victory'
			);
			expect(await readFile(join(cwd, 'src/configs/battleViewConfig.ts'), 'utf8')).toContain(
				`dimension: '${dimension}'`
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

test('game-only generators reject apps before creating broken imports', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-app-no-game-'));
	try {
		for (const kind of ['app', 'lib']) execFileSync('bun', [cli, 'new', kind, kind], { cwd: root });
		execFileSync('bun', [cli, 'new', 'game', 'game', '--dimension', '3d'], { cwd: root });
		for (const scaffold of ['game-view', 'mechanic', 'checkpoint']) {
			const info = JSON.parse(
				gameCommand(['bun', cli, 'info', scaffold, '--json'], root, {
					cli,
					workload: 'game-info-' + scaffold,
					units: ['template.game-scaffold-details']
				}).stdout
			);
			expect(info.rules).toContain('This scaffold belongs in Harness game projects.');
			for (const kind of ['app', 'lib']) {
				const result = spawnSync('bun', [cli, 'generate', scaffold, 'movement'], {
					cwd: join(root, kind),
					encoding: 'utf8'
				});
				expect(result.status, `${scaffold} in ${kind}`).not.toBe(0);
				expect(result.stderr).toContain('Game scaffolds require a Harness game project.');
			}
			const [, ...args] = info.exampleCommands[0].split(' ');
			const output = execFileSync('bun', [cli, ...args], {
				cwd: join(root, 'game'),
				encoding: 'utf8'
			});
			const emitted = [...output.matchAll(/^ {2}create (\S+)$/gm)].map((match) => match[1]);
			expect(emitted.length).toBeGreaterThan(0);
			for (const path of emitted)
				expect(info.contains.join('\n')).toContain(path.replaceAll('example', '<name>'));
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 30_000);

/** The generated project's ordinary test entrypoint enforces the author's graph contract. */
async function invalidGames(cwd: string, valid: GameDocument) {
	const cases: [string, (document: GameDocument) => void][] = [
		[
			'Unknown checkpoint',
			(d) => {
				d.views[0].checkpoints[0].requires = ['missing'];
			}
		],
		[
			'duplicate id',
			(d) => {
				d.views[0].checkpoints[1].id = d.views[0].checkpoints[0].id;
			}
		],
		[
			'Cyclic checkpoint',
			(d) => {
				d.views[0].checkpoints[0].requires = [d.views[0].checkpoints[1].id];
				d.views[0].checkpoints[1].requires = [d.views[0].checkpoints[0].id];
			}
		],
		[
			'Unknown view',
			(d) => {
				d.views[0].checkpoints[0].actions.push({
					type: 'transition',
					target: 'missing',
					value: true
				});
			}
		]
	];
	for (const [message, change] of cases) {
		const document = globalThis.structuredClone(valid);
		change(document);
		await writeFile(join(cwd, 'game.json'), JSON.stringify(document, null, '\t') + '\n');
		const result = spawnSync('bun', ['run', 'test:unit'], { cwd, encoding: 'utf8' });
		expect(result.status, 'Invalid graph must fail the generated project check').toBe(1);
		expect(result.stdout + result.stderr).toContain(message);
	}
	await writeFile(join(cwd, 'game.json'), JSON.stringify(valid, null, '\t') + '\n');
}
