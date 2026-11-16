import type { RenderSession } from '../../models/game-authoring/Game.types';

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
