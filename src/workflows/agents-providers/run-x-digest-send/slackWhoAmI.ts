// @harness-uid u_yoy3rxeugg
import { z } from 'zod';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

const reply = z.object({
	ok: z.literal(true),
	team_id: z.string(),
	bot_id: z.string(),
	user_id: z.string()
});

/** The bot's non-secret ids from `auth.test`, needed once to write the sender config. */
export async function slackWhoAmI(token: string, request: typeof fetch = fetch) {
	const response = await request('https://slack.com/api/auth.test', {
		method: 'POST',
		redirect: 'error',
		signal: AbortSignal.timeout(10_000),
		headers: { authorization: `Bearer ${token}` }
	}).catch(() => undefined);
	const body = reply.safeParse(await response?.json().catch(() => undefined));
	if (!body.success) throw new ExpectedCliError('Slack did not accept auth.test for that token.');
	const { team_id: workspaceId, bot_id: botId, user_id: botUserId } = body.data;
	return { workspaceId, botId, botUserId };
}
