import type { RenderSession } from '../../models/game-authoring/Game.types';

export class DecartTransportUnavailableError extends Error {
	override name = 'DecartTransportUnavailableError';
}

export class DecartPreviewCancelledError extends Error {
	override name = 'DecartPreviewCancelledError';
}

export class DecartConnectionFailedError extends Error {
	override name = 'DecartConnectionFailedError';
}

export interface VideoConnection {
	disconnect(): void;
	setPrompt(text: string): Promise<void>;
	on(event: 'error' | 'sessionEnded', listener: () => void): void;
}

export type VideoConnector = (
	source: MediaStream,
	options: {
		session: RenderSession;
		prompt: string;
		retries: 0;
		capacityRetryBudgetMs: 0;
		onRemoteStream: (stream: MediaStream) => void;
	}
) => Promise<VideoConnection>;

export type Prompt = string | { prompt: string; signal?: AbortSignal; connector?: VideoConnector };
