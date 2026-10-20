import { expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from '../project-fixture';
import { GameImageService } from '../../src/services/GameImageService';
import { GameDocumentRepository } from '../../../game/src/repositories/GameDocumentRepository';
import { exampleDocument } from '../../../game/src/utils/keyDoor';
import { IpcRequestValidator } from '../../src/validators/IpcRequestValidator';
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
	'base64'
);
test('checkpoint generation binds project, persists an image and retains editable document ownership', async () => {
	const { root, session, tip } = await fixture();
	const document = exampleDocument();
	await writeFile(join(root, 'game.json'), JSON.stringify(document));
	await writeFile(join(root, '.gitignore'), '.env.local\n');
	await writeFile(
		join(root, '.env.local'),
		'HARNESS_GAME_OPENAI_API_KEY=synthetic-image-project-key\n'
	);
	const { revision } = await new GameDocumentRepository(root).read();
	let deliver!: (bytes: Buffer) => void;
	const generate = vi.fn(
		() =>
			new Promise<Buffer>((resolve) => {
				deliver = resolve;
			})
	);
	const service = new GameImageService(session, { generate });
	const input = {
		projectId: session.projectId!,
		document,
		viewId: document.views[0].id,
		checkpointId: 'key',
		expectedRevision: revision
	};
	const pending = service.generate(input);
	await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
	await expect(service.generate(input)).rejects.toThrow('Wait');
	deliver(png);
	const result = await pending;
	expect(result.image.model).toBe('gpt-image-2');
	expect(result.image.prompt).toContain('Collect the key');
	expect(generate).toHaveBeenCalledWith(
		'synthetic-image-project-key',
		expect.stringContaining(document.views[0].style)
	);
	expect(await service.read({ projectId: input.projectId, path: result.image.path })).toBe(
		result.dataUrl
	);
	expect((await new GameDocumentRepository(root).read()).revision).toBe(revision);
	await expect(service.generate({ ...input, projectId: 'other' })).rejects.toThrow('not selected');
	await expect(service.generate({ ...input, expectedRevision: '0'.repeat(64) })).rejects.toThrow(
		'changed'
	);
	await session.snapshot({ branch: null, commit: tip });
	await expect(service.generate(input)).rejects.toThrow('read-only');
	expect(generate).toHaveBeenCalledTimes(1);
});
test('image IPC rejects arbitrary paths, remote identities and invalid documents', () => {
	const validator = new IpcRequestValidator();
	expect(() =>
		validator.parse('game:image-read', {
			projectId: 'local-' + 'a'.repeat(64),
			path: '../.env.local'
		})
	).toThrow();
	expect(() =>
		validator.parse('game:image-generate', {
			projectId: 'shared-anything',
			document: exampleDocument()
		})
	).toThrow();
});
