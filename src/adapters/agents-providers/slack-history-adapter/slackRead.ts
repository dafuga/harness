// @harness-uid u_bd5orhfrvh
import { QaSyncError } from '../../../core/agents-providers/QaSyncError';
import { setTimeout as delay } from 'node:timers/promises';
import type { SlackHistoryAdapterConfig } from '../SlackHistoryAdapter.types';
import type { SlackReadMethod, SlackReadReply } from './slackRead.types';

const attempts = 4;
const maxWaitSeconds = 90;

/** One Slack Web API read, waiting out rate limits. Errors carry Slack's code only. */
export async function slackRead(
	config: SlackHistoryAdapterConfig,
	method: SlackReadMethod,
	query: Record<string, string>
): Promise<SlackReadReply> {
	const url = new URL(`https://slack.com/api/${method}`);
	for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
	for (let attempt = 1; ; attempt++) {
		const response = await (config.fetch ?? fetch)(url, {
			redirect: 'error',
			signal: AbortSignal.timeout(15_000),
			headers: { authorization: `Bearer ${await config.token()}` }
		});
		if (response.status === 429 && attempt < attempts) {
			await (config.sleep ?? delay)(waitMs(response.headers));
			continue;
		}
		if (!response.ok)
			throw new QaSyncError(`Slack ${method} refused with status ${response.status}.`);
		return checked(method, (await response.json()) as SlackReadReply);
	}
}

function checked(method: SlackReadMethod, reply: SlackReadReply): SlackReadReply {
	if (reply.ok || reply.error === 'thread_not_found') return reply;
	const code = /^[a-z_]{1,64}$/.test(reply.error ?? '') ? reply.error : 'unknown_error';
	throw new QaSyncError(`Slack ${method} refused: ${code}.`);
}

function waitMs(headers: Headers): number {
	const seconds = Number(headers.get('retry-after')) || 1;
	return Math.min(maxWaitSeconds, Math.max(1, seconds)) * 1000;
}
