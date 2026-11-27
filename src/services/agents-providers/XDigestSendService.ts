// @harness-uid u_x2f4mju4ib
import type { XDigestSendReport } from '../../core/agents-providers/xDigestSend.types';
import type { XDigestSendPorts } from './XDigestSendService.types';
import { parseXDigestOutbox } from './x-digest-send-service/parseXDigestOutbox';

/** Posts one day's collected digest exactly once, resuming after the last delivered message. */
export class XDigestSendService {
	constructor(private readonly ports: XDigestSendPorts) {}

	async run(): Promise<XDigestSendReport> {
		const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(
			this.ports.now?.() ?? new Date()
		);
		const state = await this.ports.state.load();
		if (state.day !== day) Object.assign(state, { day, next: 0, closed: false });
		if (state.closed) return { status: 'already-sent' };
		const text = await this.ports.fetch(day);
		const entry = text === undefined ? undefined : parseXDigestOutbox(text, day);
		if (!entry) return { status: 'waiting' };
		if ('blocked' in entry) return { status: 'blocked', detail: entry.blocked };
		return this.post(state, entry.messages);
	}

	/**
	 * A refused message can be retried. One whose delivery is unknown closes the day, so a retry
	 * cannot post it twice.
	 */
	private async post(
		state: Awaited<ReturnType<XDigestSendPorts['state']['load']>>,
		messages: string[]
	): Promise<XDigestSendReport> {
		while (state.next < messages.length) {
			const result = await this.ports.send(messages[state.next]);
			if (result.status !== 'sent') {
				state.closed = result.status === 'unknown';
				await this.ports.state.save(state);
				await this.ports.ask(
					`X digest: Slack did not confirm today’s digest (${result.code}). ` +
						(state.closed ? 'It was not re-sent, to avoid a duplicate.' : 'It can be retried.')
				);
				return { status: 'send-failed', detail: result.code };
			}
			state.next++;
			await this.ports.state.save(state);
		}
		state.closed = true;
		await this.ports.state.save(state);
		return { status: 'sent', messages: messages.length };
	}
}
