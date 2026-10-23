import { expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from '../../project-fixture';
import { GameLevelService } from '../../../src/lib/development-tooling/desktop-bridge/GameLevelService';
import { ProviderDiscoveryService } from '../../../src/services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import { GameDocumentRepository } from '../../../../game/src/repositories/game-authoring/GameDocumentRepository';
import { exampleDocument } from '../../../../game/src/utils/game-authoring/keyDoor';
import type { AgentRunner } from '../../../src/models/agents-providers/AgentRunner.types';
const layout = {
	width: 12,
	depth: 8,
	spawn: { x: 1, z: 1 },
	objects: [
		{ id: 'goal', kind: 'goal', label: 'Lantern', x: 10, z: 6, width: 1, depth: 1, height: 1 }
	]
};
function runner(): AgentRunner {
	return {
		discover: async () => ({
			id: 'codex',
			label: 'Codex',
			available: true,
			reason: null,
			version: 'test',
			imageGeneration: false,
			models: [
				{ id: 'fixture', label: 'Fixture', efforts: [], defaultEffort: null, isDefault: true }
			]
		}),
		run: vi.fn(async () => ({
			text: JSON.stringify({ summary: 'Reach the lantern', layout }),
			model: 'fixture'
		}))
	};
}
async function setup() {
	const { root, session, tip } = await fixture();
	const document = exampleDocument();
	document.views[0].planning = { concept: 'Island', description: 'Reach the lantern' };
	await writeFile(join(root, 'game.json'), JSON.stringify(document));
	const { revision } = await new GameDocumentRepository(root).read();
	const model = runner(),
		providers = new ProviderDiscoveryService({ codex: model, claude: model });
	return {
		root,
		session,
		tip,
		model,
		service: new GameLevelService(session, providers),
		input: {
			projectId: session.projectId!,
			document,
			viewId: document.views[0].id,
			expectedRevision: revision,
			provider: 'codex' as const,
			model: 'fixture'
		}
	};
}
test('level generation returns bounded geometry without approving, building or saving', async () => {
	const { root, session, tip, model, service, input } = await setup();
	const result = await service.generate(input);
	expect(result.proposal.layout).toEqual(layout);
	vi.mocked(model.run).mockResolvedValueOnce({
		text:
			JSON.stringify({ summary: 'Progress draft', layout }) +
			'\n' +
			JSON.stringify({ summary: 'Final island', layout }),
		model: 'fixture'
	});
	expect((await service.generate(input)).proposal.summary).toBe('Final island');
	expect(result.proposal.id).toMatch(/^[a-f0-9]{64}$/);
	expect(result.proposal).not.toHaveProperty('approved');
	expect(input.document.views[0].planning).not.toHaveProperty('proposal');
	expect((await new GameDocumentRepository(root).read()).revision).toBe(input.expectedRevision);
	expect(model.run).toHaveBeenCalledWith(
		expect.objectContaining({ access: 'read-only', model: 'fixture', cwd: root })
	);
	await expect(service.generate({ ...input, projectId: 'other' })).rejects.toThrow('not selected');
	await expect(service.generate({ ...input, expectedRevision: '0'.repeat(64) })).rejects.toThrow(
		'changed'
	);
	await session.snapshot({ branch: null, commit: tip });
	await expect(service.generate(input)).rejects.toThrow('read-only');
});
test('level generation rejects malformed responses, provider failures and model substitutions', async () => {
	const { model, service, input } = await setup();
	vi.mocked(model.run).mockResolvedValueOnce({
		text: '{"summary":"Unsafe","layout":{"width":999}}',
		model: 'fixture'
	});
	await expect(service.generate(input)).rejects.toThrow('invalid level layout');
	vi.mocked(model.run).mockResolvedValueOnce({ text: 'Not a JSON level.', model: 'fixture' });
	await expect(service.generate(input)).rejects.toThrow('invalid level layout');
	vi.mocked(model.run).mockRejectedValueOnce(new Error('quota exhausted'));
	await expect(service.generate(input)).rejects.toThrow('quota exhausted');
	vi.mocked(model.run).mockResolvedValueOnce({
		text: JSON.stringify({ summary: 'Level', layout }),
		model: 'other'
	});
	await expect(service.generate(input)).rejects.toThrow('different model');
	expect(input.document.views[0].planning).not.toHaveProperty('approved');
});

test('late generation cannot accept changed files and duplicate requests stay blocked', async () => {
	const { root, model, service, input } = await setup();
	let deliver!: (result: { text: string; model: string }) => void;
	vi.mocked(model.run).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				deliver = resolve;
			})
	);
	const pending = service.generate(input);
	await vi.waitFor(() => expect(model.run).toHaveBeenCalledTimes(1));
	await expect(service.generate(input)).rejects.toThrow('Wait');
	await writeFile(join(root, 'game.json'), JSON.stringify({ ...input.document, mechanics: [] }));
	deliver({ text: JSON.stringify({ summary: 'Late proposal', layout }), model: 'fixture' });
	await expect(pending).rejects.toThrow('changed');
	expect(input.document.views[0].planning).not.toHaveProperty('proposal');
});

test('level IPC validates provider, feedback, project identity and saved revision', async () => {
	const { IpcRequestValidator } =
		await import('../../../src/validators/development-tooling/IpcRequestValidator');
	const validator = new IpcRequestValidator();
	const document = exampleDocument();
	document.views[0].planning = { concept: 'Island', description: 'Reach the lantern' };
	const input = {
		projectId: 'local-' + 'a'.repeat(64),
		document,
		viewId: document.views[0].id,
		expectedRevision: 'b'.repeat(64),
		provider: 'codex',
		model: 'fixture'
	};
	expect(validator.parse('game:level-generate', input)).toEqual(input);
	for (const patch of [
		{ provider: 'unknown' },
		{ feedback: 'x'.repeat(4001) },
		{ expectedRevision: 'main' },
		{ projectId: 'shared-remote' },
		{ document: {} }
	])
		expect(() => validator.parse('game:level-generate', { ...input, ...patch })).toThrow();
});
