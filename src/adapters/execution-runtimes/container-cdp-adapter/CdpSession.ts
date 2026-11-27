// @harness-uid u_t36g6lngv3
import type { Duplex } from 'node:stream';
import type { UntrustedValue } from '../../../core/agents-providers/projectAssistant.types';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { ContainerHistoryAction, ContainerPage } from '../ContainerCdpAdapter.types';
import { pipeWebSocket } from './pipeWebSocket';
import type { CdpPending } from './CdpSession.types';

const callTimeoutMs = 30_000;

/**
 * Sends page navigation and runtime evaluation commands without overriding browser behavior.
 */
export class CdpSession implements ContainerPage {
	private sequence = 0;
	private readonly pending = new Map<number, CdpPending>();
	private socket?: { send(text: string): void };

	private constructor(private readonly stream: Duplex) {}

	static async open(stream: Duplex, path: string): Promise<CdpSession> {
		const session = new CdpSession(stream);
		session.socket = await pipeWebSocket(stream, path, {
			message: (text) => session.receive(text),
			close: () => session.drop()
		});
		return session;
	}

	async evaluate(expression: string): Promise<UntrustedValue> {
		const reply = (await this.call('Runtime.evaluate', {
			expression,
			returnByValue: true,
			awaitPromise: true
		})) as { result?: { value?: UntrustedValue }; exceptionDetails?: object };
		if (reply.exceptionDetails) throw new ExpectedCliError('A page read failed in the browser.');
		return reply.result?.value;
	}

	async navigate(url: string): Promise<void> {
		const reply = (await this.call('Page.navigate', { url })) as { errorText?: string };
		if (reply.errorText)
			throw new ExpectedCliError(`The page did not load: ${reply.errorText.slice(0, 80)}`);
	}

	async history(action: ContainerHistoryAction): Promise<void> {
		if (action === 'reload') {
			await this.call('Page.reload', {});
			return;
		}
		const { currentIndex, entries } = (await this.call('Page.getNavigationHistory', {})) as {
			currentIndex: number;
			entries: { id: number }[];
		};
		const entry = entries[currentIndex + (action === 'back' ? -1 : 1)];
		if (entry) await this.call('Page.navigateToHistoryEntry', { entryId: entry.id });
	}

	async closeBrowser(): Promise<void> {
		await this.call('Browser.close', {});
	}

	close(): void {
		this.stream.destroy();
		this.drop();
	}

	private call(method: string, params: object): Promise<unknown> {
		const id = ++this.sequence;
		return new Promise((resolve, reject) => {
			if (this.stream.destroyed) {
				reject(new ExpectedCliError('The browser pipe closed.'));
				return;
			}
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new ExpectedCliError(`The browser did not answer ${method}.`));
			}, callTimeoutMs);
			this.pending.set(id, { resolve, reject, timer });
			this.socket?.send(JSON.stringify({ id, method, params }));
		});
	}

	private receive(text: string): void {
		const message = JSON.parse(text) as { id?: number; result?: unknown; error?: unknown };
		const waiting = message.id === undefined ? undefined : this.pending.get(message.id);
		if (!waiting) return;
		this.pending.delete(message.id as number);
		clearTimeout(waiting.timer);
		if (message.error) waiting.reject(new ExpectedCliError('The browser refused a request.'));
		else waiting.resolve(message.result);
	}

	private drop(): void {
		for (const { reject, timer } of this.pending.values()) {
			clearTimeout(timer);
			reject(new ExpectedCliError('The browser pipe closed.'));
		}
		this.pending.clear();
	}
}
