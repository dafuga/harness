import { createDecartClient } from '@decartai/sdk';
import { DecartAdapter } from '../../../game/src/adapters/DecartAdapter';
import type { RenderSessionRequest } from '../../../game/src/models/Game.types';
import type { ProjectSessionService } from './ProjectSessionService';
import { projectGameCredential } from '../utils/projectGameCredential';
const renderers = new Map<string, DecartAdapter>();

export class GameRenderService {
	constructor(
		private session: ProjectSessionService,
		private transportReady = () => false
	) {}
	async start(input: RenderSessionRequest) {
		this.session.assertProject(input.projectId);
		const { root } = await this.session.mutable();
		if (this.session.busy) throw new Error('Wait for the current run.');
		if (!this.transportReady())
			throw new Error(
				'Live AI is blocked until a credential-safe provider transport is available.'
			);
		let adapter = renderers.get(root);
		if (!adapter) {
			const key = await projectGameCredential(root, 'HARNESS_GAME_DECART_API_KEY');
			adapter = new DecartAdapter(createDecartClient({ apiKey: key }).tokens);
			renderers.set(root, adapter);
		}
		return adapter.start(input);
	}
}
