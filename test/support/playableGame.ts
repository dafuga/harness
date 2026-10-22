import { expect } from 'vitest';
import { stripVTControlCharacters } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import type { GameDocument } from '../../packages/game/src/models/game-authoring/Game.types';
import { freePort } from './workers';

/** The ordinary CLI matrix also plays its emitted page in the shared browser fixture. */
export async function playableGame(cwd: string) {
	execFileSync('bun', ['install', '--backend=copyfile'], { cwd, stdio: 'pipe' });
	const original = await readFile(join(cwd, 'game.json'), 'utf8');
	await transitionDocument(cwd, JSON.parse(original));
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
		const url = await address(server);
		for (let read = 0; read < 2; read++) {
			const response = await fetch(url + '/game');
			expect(response.status).toBe(200);
			expect(await response.text()).toContain('<canvas');
		}
		execFileSync(
			'bun',
			[
				'run',
				'test:e2e',
				'tests/e2e/checkpoint-images.spec.ts',
				'--grep',
				'a generated game displays'
			],
			{
				cwd: resolve('packages/desktop'),
				stdio: 'inherit',
				env: {
					...process.env,
					HARNESS_VERIFY: '0',
					HARNESS_DESKTOP_TEST_PORT: String(await freePort()),
					CHECKPOINT_GAME_PROOF_URL: url,
					CHECKPOINT_GAME_TRANSITIONS: '1'
				}
			}
		);
	} finally {
		const exited = new Promise<void>((done) => server.once('exit', () => done()));
		server.kill();
		await exited;
		await writeFile(join(cwd, 'game.json'), original);
	}
}
async function transitionDocument(cwd: string, document: GameDocument) {
	const first = document.views[0],
		key = first.checkpoints[0];
	first.checkpoints = [key];
	key.actions.push({ type: 'transition', target: 'second', value: true });
	const image = {
		path: 'static/game/checkpoints/' + 'a'.repeat(64) + '.png',
		model: 'gpt-image-2' as const,
		prompt: 'Controlled asset fixture',
		createdAt: '2026-10-21T12:00:00Z'
	};
	key.image = image;
	const second = globalThis.structuredClone(first);
	second.id = 'second';
	second.title = 'Second chamber';
	second.dimension = first.dimension === '2d' ? '3d' : '2d';
	second.checkpoints[0].image = undefined;
	second.checkpoints[0].conditions = [{ field: 'x', op: 'gte', value: 3 }];
	second.checkpoints[0].actions = [{ type: 'transition', target: first.id, value: true }];
	document.views.push(second);
	await mkdir(join(cwd, 'static/game/checkpoints'), { recursive: true });
	await writeFile(
		join(cwd, image.path),
		Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
			'base64'
		)
	);
	await writeFile(join(cwd, 'game.json'), JSON.stringify(document, null, '\t') + '\n');
}
async function address(server: ReturnType<typeof spawn>): Promise<string> {
	return new Promise((done, fail) => {
		let output = '';
		const timeout = setTimeout(
			() => fail(new Error('Generated game did not start: ' + stripVTControlCharacters(output))),
			30000
		);
		server.stderr!.on('data', (chunk) => (output += String(chunk)));
		server.once('error', fail);
		server.once('exit', () => {
			clearTimeout(timeout);
			fail(new Error('Generated game exited'));
		});
		server.stdout!.on('data', (chunk) => {
			output += String(chunk);
			const url = stripVTControlCharacters(output).match(/(http:\/\/127\.0\.0\.1:\d+)\//)?.[1];
			if (url) {
				clearTimeout(timeout);
				done(url);
			}
		});
	});
}

/** Build the CLI into its disposable install root before exercising that entry. */
export function gameCli(root: string, entry: string): string {
	const cli = entry === 'source' ? resolve('src/index.ts') : join(root, 'harness.js');
	if (entry === 'bundled')
		execFileSync('bun', ['build', resolve('src/index.ts'), '--target', 'bun', '--outfile', cli], {
			stdio: 'pipe'
		});
	return cli;
}
