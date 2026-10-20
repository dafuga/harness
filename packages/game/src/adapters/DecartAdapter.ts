import type { createDecartClient } from '@decartai/sdk';
import type { RenderSessionRequest, RenderSession } from '../models/Game.types';

type TokenClient = ReturnType<typeof createDecartClient>['tokens'];
export class DecartAdapter {
	private until = 0;
	constructor(
		private tokens: Pick<TokenClient, 'create'>,
		private now = Date.now
	) {}
	async start(input: RenderSessionRequest): Promise<RenderSession> {
		validateSession(input);
		if (this.until > this.now()) throw new Error('An AI preview lease is already active.');
		this.until = this.now() + (input.seconds + 60) * 1000;
		try {
			const token = await this.tokens.create({
				expiresIn: 60,
				allowedModels: [input.model],
				constraints: { realtime: { maxSessionDuration: input.seconds } },
				metadata: { projectId: input.projectId }
			});
			return {
				apiKey: token.apiKey,
				expiresAt: token.expiresAt,
				model: input.model,
				fast: input.fast,
				seconds: input.seconds,
				rate: renderRate(input.model, input.fast)
			};
		} catch {
			this.until = 0;
			throw new Error(
				'Unable to start the Decart preview. Check this project’s provider configuration.'
			);
		}
	}
}
export function renderRate(model: string, fast: boolean): number {
	if (model === 'lucy-restyle-2') return 0.01;
	return fast ? 0.04 : 0.02;
}
export function validateSession(input: RenderSessionRequest): void {
	if (
		!['lucy-restyle-2', 'lucy-2.5'].includes(input.model) ||
		typeof input.fast !== 'boolean' ||
		(input.fast && input.model !== 'lucy-2.5') ||
		!Number.isInteger(input.seconds) ||
		input.seconds < 10 ||
		input.seconds > 60
	)
		throw new Error('Invalid AI preview. Choose a supported model and 10–60 seconds.');
}
