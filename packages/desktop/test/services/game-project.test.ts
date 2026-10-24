import { expect, test, vi } from 'vitest';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, git } from '../project-fixture';
import { GameProjectService } from '../../src/lib/development-tooling/desktop-bridge/GameProjectService';
import { GameRenderService } from '../../src/lib/development-tooling/desktop-bridge/GameRenderService';
import { exampleDocument } from '../../../game/src/utils/game-authoring/keyDoor';
import { IpcRequestValidator } from '../../src/validators/development-tooling/IpcRequestValidator';

test('game operations bind project identity, retain historical graphs and reject stale writes', async () => {
	const { session, root } = await fixture();
	await writeFile(join(root, 'game.json'), JSON.stringify(exampleDocument()));
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({ harness: { kind: 'game', dimension: '3d' } })
	);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'feat: fixture game');
	const commit = git(root, 'rev-parse', 'HEAD');
	const snapshot = await session.snapshot({ branch: null, commit: null });
	expect(snapshot.project.kind).toBe('game');
	const projectId = session.projectId!;
	const game = new GameProjectService(session),
		first = await game.read({ projectId });
	first.document.views[0].title = 'New courtyard';
	await game.save({ projectId, document: first.document, expectedRevision: first.revision });
	expect((await game.read({ projectId })).document.views[0].title).toBe('New courtyard');
	expect((await game.read({ projectId, commit })).document.views[0].title).toBe('The courtyard');
	await expect(
		game.save({ projectId, document: first.document, expectedRevision: first.revision })
	).rejects.toThrow('changed');
	await expect(game.read({ projectId: 'different' })).rejects.toThrow('not selected');
	await session.snapshot({ branch: null, commit });
	const current = await game.read({ projectId });
	await expect(
		game.save({ projectId, document: current.document, expectedRevision: current.revision })
	).rejects.toThrow('read-only');
	await expect(
		new GameRenderService(session).start({
			projectId,
			model: 'lucy-restyle-2',
			fast: false,
			seconds: 60
		})
	).rejects.toThrow('read-only');
}, 20_000);

test('invalid game requests fail at the transport boundary', () => {
	const validator = new IpcRequestValidator();
	expect(() =>
		validator.parse('game:create', { name: '../outside', kind: 'game', dimension: '2d' })
	).toThrow();
	expect(() =>
		validator.parse('game:render', {
			projectId: 'local-' + 'a'.repeat(64),
			model: 'lucy-2.5',
			fast: false,
			seconds: 3600
		})
	).toThrow();
	expect(() =>
		validator.parse('game:save', {
			projectId: 'local-' + 'a'.repeat(64),
			document: {},
			expectedRevision: 'b'.repeat(64)
		})
	).toThrow();
});

test('project creation initializes a game without overwriting an existing directory', async () => {
	const { session, root } = await fixture();
	const service = new GameProjectService(session, join(root, 'projects'));
	// The fixture's Git identity is local to its repository, so the created child gets its own.
	const identity = { NAME: 'Game Author', EMAIL: 'game@example.invalid' };
	for (const [name, value] of Object.entries(identity)) {
		vi.stubEnv('GIT_AUTHOR_' + name, value);
		vi.stubEnv('GIT_COMMITTER_' + name, value);
	}
	const created = await service
		.create({ name: 'test-game', kind: 'game', dimension: '3d' })
		.finally(() => vi.unstubAllEnvs());
	expect(created.project.kind).toBe('game');
	expect(created.project.dimension).toBe('3d');
	expect(created.writable).toBe(true);
	const planned = await service.read({ projectId: created.project.id! });
	expect(planned.document.views[0].planning).toEqual({ concept: '', description: '' });
	expect(planned.document.views[0].checkpoints).toEqual([]);
	const log = git(join(root, 'projects', 'test-game'), 'log', '-1', '--format=%an %ae|%cn %ce');
	expect(log).toBe('Game Author game@example.invalid|Game Author game@example.invalid');
	await expect(
		service.create({ name: 'test-game', kind: 'game', dimension: '2d' })
	).rejects.toThrow('already exists');
	await mkdir(join(root, 'projects', 'user-folder'));
	await writeFile(join(root, 'projects', 'user-folder', 'notes.txt'), 'mine');
	await expect(
		service.create({ name: 'user-folder', kind: 'game', dimension: '2d' })
	).rejects.toThrow('already exists');
	expect(await readFile(join(root, 'projects', 'user-folder', 'notes.txt'), 'utf8')).toBe('mine');
}, 30_000);

test('failed project creation reports its cause, removes only its own target and can be retried', async () => {
	const { session, root } = await fixture();
	const projects = join(root, 'projects'),
		target = join(projects, 'retry-game'),
		service = new GameProjectService(session, projects),
		input = { name: 'retry-game', kind: 'game', dimension: '2d' } as const;
	await mkdir(projects);
	await chmod(projects, 0o500);
	await expect.soft(service.create(input)).rejects.toMatchObject({ code: 'EACCES' });
	await chmod(projects, 0o700);
	const identity = join(root, 'git-identity');
	await writeFile(identity, '[user]\n\tuseConfigOnly = true\n');
	vi.stubEnv('GIT_CONFIG_GLOBAL', identity);
	vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
	for (const name of ['NAME', 'EMAIL']) {
		vi.stubEnv('GIT_AUTHOR_' + name, undefined);
		vi.stubEnv('GIT_COMMITTER_' + name, undefined);
	}
	vi.stubEnv('EMAIL', undefined);
	try {
		await expect(service.create(input)).rejects.toThrow(/user\.email|identity|who you are/);
		expect.soft(existsSync(target), 'owned partial target removed').toBe(false);
		await writeFile(identity, '[user]\n\tname = Retry Author\n\temail = retry@example.invalid\n');
		const created = await service.create(input);
		expect(created.project.kind).toBe('game');
		expect(git(target, 'log', '-1', '--format=%an <%ae>')).toBe(
			'Retry Author <retry@example.invalid>'
		);
		vi.spyOn(session, 'open').mockRejectedValueOnce(new Error('registry unavailable'));
		await expect(service.create({ ...input, name: 'opened-later' })).rejects.toThrow(
			'registry unavailable'
		);
		expect(git(join(projects, 'opened-later'), 'status', '--porcelain')).toBe('');
	} finally {
		vi.unstubAllEnvs();
	}
}, 30_000);

test('AI preview fails closed before credential access without a safe transport', async () => {
	const { session } = await fixture();
	await expect(
		new GameRenderService(session).start({
			projectId: session.projectId!,
			model: 'lucy-restyle-2',
			fast: false,
			seconds: 10
		})
	).rejects.toThrow('credential-safe provider transport');
});

test('prepared token minting uses only the server HTTP endpoint with bounded header-auth requests', async () => {
	const { root, session } = await fixture();
	await writeFile(join(root, '.gitignore'), '.env.local\n');
	await writeFile(join(root, '.env.local'), 'HARNESS_GAME_DECART_API_KEY=synthetic-decart-key\n');
	const send = vi.fn(
		async () =>
			new Response(JSON.stringify({ apiKey: 'synthetic-ephemeral', expiresAt: '2099-01-01' }))
	);
	const service = new GameRenderService(session, () => true, send);
	const result = await service.start({
		projectId: session.projectId!,
		model: 'lucy-restyle-2',
		fast: false,
		seconds: 10
	});
	expect(result.apiKey).toBe('synthetic-ephemeral');
	const [url, options] = send.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('https://api.decart.ai/v1/client/tokens');
	expect(options.headers).toMatchObject({ 'X-API-KEY': 'synthetic-decart-key' });
	expect(options.redirect).toBe('error');
	expect(JSON.parse(String(options.body))).toMatchObject({
		expiresIn: 60,
		constraints: { realtime: { maxSessionDuration: 10 } }
	});
});
