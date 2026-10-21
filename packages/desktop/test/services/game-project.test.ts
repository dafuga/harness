import { expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, git } from '../project-fixture';
import { GameProjectService } from '../../src/services/GameProjectService';
import { GameRenderService } from '../../src/services/GameRenderService';
import { exampleDocument } from '../../../game/src/utils/keyDoor';
import { IpcRequestValidator } from '../../src/validators/IpcRequestValidator';

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
	const created = await service.create({ name: 'test-game', kind: 'game', dimension: '3d' });
	expect(created.project.kind).toBe('game');
	expect(created.project.dimension).toBe('3d');
	expect(created.writable).toBe(true);
	await expect(
		service.create({ name: 'test-game', kind: 'game', dimension: '2d' })
	).rejects.toThrow('already exists');
});

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
