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
type Prompt = string | { prompt: string; signal?: AbortSignal; connector?: VideoConnector };
/** The public vendor SDK puts its client credential in a URL. No safe transport is registered. */
export function decartTransportReady(): boolean {
	return false;
}

/** Canvas only: no camera, microphone, credentials in addresses, or automatic retry. */
export class DecartStreamAdapter {
	constructor(private readonly canvas: HTMLCanvasElement) {}
	connect(session: RenderSession, prompt: Prompt, onStream: (stream: MediaStream) => void) {
		return connectCanvas(this.canvas, session, prompt, onStream);
	}
}

/** The existing connector entry delegates to its canvas transport owner. */
export function connectDecart(
	canvas: HTMLCanvasElement,
	session: RenderSession,
	prompt: Prompt,
	onStream: (stream: MediaStream) => void
) {
	return new DecartStreamAdapter(canvas).connect(session, prompt, onStream);
}

async function connectCanvas(
	canvas: HTMLCanvasElement,
	session: RenderSession,
	prompt: Prompt,
	onStream: (stream: MediaStream) => void
) {
	const connector = typeof prompt === 'string' ? undefined : prompt.connector;
	if (!connector)
		throw new Error(
			'Live AI is unavailable until a credential-safe provider transport is configured.'
		);
	const source = canvas.captureStream(25);
	const signal = typeof prompt === 'string' ? undefined : prompt.signal;
	const life = canvasLife(source, session.seconds, signal);
	if (life.ended()) throw new Error('AI preview cancelled.');
	try {
		const connection = await connector(source, {
			session,
			prompt: typeof prompt === 'string' ? prompt : prompt.prompt,
			retries: 0,
			capacityRetryBudgetMs: 0,
			onRemoteStream: (remote) => life.receive(remote, onStream)
		});
		life.attach(connection);
		return {
			stop: life.stop,
			ended: life.ended,
			setPrompt: (text: string) => {
				void connection.setPrompt(text).catch(life.stop);
			}
		};
	} catch {
		life.stop();
		throw new Error('AI video connection failed. The simple renderer remains available.');
	}
}

function canvasLife(source: MediaStream, seconds: number, signal?: AbortSignal) {
	let stopped = false,
		connection: VideoConnection | undefined,
		output: MediaStream | undefined;
	const stop = () => {
		if (stopped) return;
		stopped = true;
		globalThis.clearTimeout(timer);
		globalThis.document.removeEventListener('visibilitychange', visibility);
		signal?.removeEventListener('abort', stop);
		connection?.disconnect();
		source.getTracks().forEach((track) => track.stop());
		output?.getTracks().forEach((track) => track.stop());
	};
	const visibility = () => {
		if (globalThis.document.hidden) stop();
	};
	const timer = globalThis.setTimeout(stop, seconds * 1000);
	globalThis.document.addEventListener('visibilitychange', visibility);
	signal?.addEventListener('abort', stop, { once: true });
	if (signal?.aborted) stop();
	return {
		stop,
		ended: () => stopped,
		attach(client: VideoConnection) {
			connection = client;
			if (stopped) client.disconnect();
			client.on('error', stop);
			client.on('sessionEnded', stop);
		},
		receive(remote: MediaStream, onStream: (stream: MediaStream) => void) {
			output = remote;
			if (stopped) remote.getTracks().forEach((track) => track.stop());
			else onStream(remote);
		}
	};
}
