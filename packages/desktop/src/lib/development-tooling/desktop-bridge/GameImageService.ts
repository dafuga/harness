import { LevelValidator } from '../../../../../game/src/validators/game-authoring/LevelValidator';
import type { Request } from './GameImageService.types';
import { GameDocumentRepository } from '../../../../../game/src/repositories/game-authoring/GameDocumentRepository';
import { CheckpointImageRepository } from '../../../../../game/src/repositories/game-authoring/CheckpointImageRepository';
import { GptImageAdapter } from '../../../../../game/src/adapters/agents-providers/GptImageAdapter';
import { assertDocument } from '../../../../../game/src/validators/game-authoring/gameDocument';
import type { CheckpointImage } from '../../../../../game/src/models/game-authoring/Game.types';
import type { GameDesktopBridge } from '../../../models/game-authoring/GameDesktopBridge.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import { ProjectGameCredentialAdapter } from '../../../adapters/game-authoring/ProjectGameCredentialAdapter';
const active = new Set<string>();
export class GameImageService {
	constructor(
		private session: ProjectSessionService,
		private adapter: Pick<GptImageAdapter, 'generate'> = new GptImageAdapter()
	) {}
	async generate(input: Request) {
		this.session.assertProject(input.projectId);
		const { root } = await this.session.mutable();
		if (this.session.busy || active.has(root))
			throw new Error('Wait for the current game operation.');
		active.add(root);
		try {
			return await this.create(root, input);
		} finally {
			active.delete(root);
		}
	}
	async read(input: Parameters<NonNullable<GameDesktopBridge['gameImageRead']>>[0]) {
		this.session.assertProject(input.projectId);
		const { root } = this.session.requireProject();
		return new CheckpointImageRepository(root).read(input.path, input.commit);
	}
	private async create(root: string, input: Request) {
		assertDocument(input.document);
		const view = input.document.views.find((v) => v.id === input.viewId);
		const node = view?.checkpoints.find((c) => c.id === input.checkpointId);
		if (!view || !node) throw new Error('Select an existing game checkpoint.');
		if (!LevelValidator.isReady(view))
			throw new Error('Approve and build the level before creating checkpoint images.');
		const saved = await new GameDocumentRepository(root).read();
		if (saved.revision !== input.expectedRevision)
			throw new Error('The game changed. Reload before generating.');
		const prompt = [
			'Create a polished gameplay checkpoint image, a visual target for a game.',
			'Keep consistent characters, environment and art direction. Show the checkpoint state. No HUD, text labels or UI.',
			'View: ' + view.title + ' (' + view.dimension + '). Style: ' + view.style,
			'Checkpoint: ' + node.title + '. Guidance: ' + node.description,
			'Visual direction: ' + (node.imagePrompt ?? ''),
			'Prerequisites: ' + JSON.stringify(node.requires),
			'Conditions: ' + JSON.stringify(node.conditions),
			'Consequences: ' + JSON.stringify(node.actions)
		].join('\n');
		if (prompt.length > 20000) throw new Error('Checkpoint image guidance is too long.');
		const key = await new ProjectGameCredentialAdapter(root).read('HARNESS_GAME_OPENAI_API_KEY');
		const bytes = await this.adapter.generate(key, prompt);
		const path = await new CheckpointImageRepository(root).save(bytes);
		const image: CheckpointImage = {
			path,
			model: 'gpt-image-2',
			prompt,
			createdAt: new Date().toISOString()
		};
		return { image, dataUrl: 'data:image/png;base64,' + bytes.toString('base64') };
	}
}
