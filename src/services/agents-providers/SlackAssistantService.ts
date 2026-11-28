// @harness-uid u_mrsb2rmpyo
import { ProjectAssistantError } from '../../core/agents-providers/ProjectAssistantError';
import type { PlatformEvent } from '../../core/agents-providers/platformAdapter.types';
import { redactSecrets } from '../../utils/agents-providers/redactSecrets';
import type { SlackAssistantServiceOptions } from './SlackAssistantService.types';

const queueLimit = 24;

/** Receives Slack events quickly and runs model calls outside Socket Mode acknowledgement. */
export class SlackAssistantService {
	private pending = 0;
	private drain = Promise.resolve();

	constructor(private readonly options: SlackAssistantServiceOptions) {}

	async run(signal: AbortSignal): Promise<void> {
		try {
			await this.options.slack.subscribe(async (event) => this.enqueue(event), signal);
		} finally {
			await this.drain;
		}
	}

	private enqueue(event: PlatformEvent): void {
		if (this.pending >= queueLimit) {
			// Leave the event unacknowledged so Slack can retry.
			throw new ProjectAssistantError('Assistant queue is full.');
		}
		this.pending++;
		this.drain = this.drain.then(async () => {
			try {
				await this.reply(event);
			} catch {
				this.options.report('assistant-reply-failed');
			} finally {
				this.pending--;
			}
		});
	}

	private async reply(event: PlatformEvent): Promise<void> {
		const { slack, assistant, botUserId, report } = this.options;
		const text = event.text.replaceAll('<@' + botUserId + '>', '').trim();
		if (!text) return;
		let answer: string;
		try {
			answer = (
				await assistant.answer({
					text,
					senderId: event.senderId,
					channelId: event.channelId,
					allowWrite:
						/^(create (?:a |an )?(?:github issue|tracker item)|launch (?:a |the )?tracker item)\b/i.test(
							text
						)
				})
			).text;
		} catch {
			report('assistant-answer-failed');
			answer = 'I couldn’t answer that right now. Please try again shortly.';
		}
		const reply = await slack.send({
			channelId: event.channelId,
			threadId: event.threadId ?? event.messageId,
			text: redactSecrets(answer)
				.replace(/<([!@#])/g, '&lt;$1')
				.slice(0, 4000)
		});
		if (reply.status !== 'sent' || !reply.auditRecorded) report('assistant-send-failed');
	}
}
