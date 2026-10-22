import { DecartAdapter } from '../../../../../game/src/adapters/agents-providers/DecartAdapter';
import type { RenderSessionRequest } from '../../../../../game/src/models/game-authoring/Game.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import { ProjectGameCredentialAdapter } from '../../../adapters/game-authoring/ProjectGameCredentialAdapter';
const renderers = new Map<string, DecartAdapter>();

export class GameRenderService {
	constructor(
		private session: ProjectSessionService,
		private transportReady = () => false,
		private send: (url: string, options: RequestInit) => Promise<Response> = globalThis.fetch
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
			const key = await new ProjectGameCredentialAdapter(root).read('HARNESS_GAME_DECART_API_KEY');
			adapter = new DecartAdapter(serverTokens(key, this.send));
			renderers.set(root, adapter);
		}
		return adapter.start(input);
	}
}

/** Keep the server token API separate from the vendor's browser/WebRTC runtime. */
function serverTokens(
	key: string,
	send: (url: string, options: RequestInit) => Promise<Response>
): ConstructorParameters<typeof DecartAdapter>[0] {
	return {
		create: async (options) => {
			const response = await send('https://api.decart.ai/v1/client/tokens', {
				method: 'POST',
				redirect: 'error',
				signal: AbortSignal.timeout(30000),
				headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
				body: JSON.stringify(options)
			});
			if (!response.ok) throw new Error('Token request failed.');
			const token = (await response.json()) as { apiKey: string; expiresAt: string };
			if (typeof token?.apiKey !== 'string' || typeof token.expiresAt !== 'string')
				throw new Error('Invalid token response.');
			return token;
		}
	};
}
