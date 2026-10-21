import { expect, test } from 'vitest';
import { stripVTControlCharacters } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { GameDocumentRepository } from '../packages/game/src/repositories/GameDocumentRepository';
import type { GameDocument } from '../packages/game/src/models/Game.types';
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
			const repository = new GameDocumentRepository(cwd);
			const saved = await repository.read();
			saved.document.views[0].title = 'Authored courtyard';
			await repository.save(saved.document, saved.revision);
			execFileSync('bun', ['run', 'check'], { cwd, stdio: 'pipe' });
			await invalidGames(cwd, saved.document);
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
		{
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, FORCE_COLOR: '1', NO_COLOR: undefined }
		}
	);
	try {
		const url = await new Promise<string>((resolveUrl, reject) => {
			let output = '';
			const timeout = setTimeout(
				() =>
					reject(new Error('Generated game did not start: ' + stripVTControlCharacters(output))),
				30_000
			);
			server.stderr.on('data', (chunk) => {
				output += String(chunk);
			});
			server.once('exit', () => {
				clearTimeout(timeout);
				reject(new Error('Generated game exited'));
			});
			server.once('error', reject);
			server.stdout.on('data', (chunk) => {
				output += String(chunk);
				const address = stripVTControlCharacters(output).match(
					/(http:\/\/127\.0\.0\.1:\d+)\//
				)?.[1];
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
