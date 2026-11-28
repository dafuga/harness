// @harness-uid u_gvqtr5mdwv
import { z } from 'zod';
import { SlackAdapter } from '../../../adapters/agents-providers/SlackAdapter';
import {
	channelId,
	slackTimestamp
} from '../../../adapters/agents-providers/slack-adapter/slackWire';
import { TrackerGithubCommentAdapter } from '../../../adapters/projects-sessions/TrackerGithubCommentAdapter';
import { TrackerSmsSendAdapter } from '../../../adapters/projects-sessions/TrackerSmsSendAdapter';
import { TrackerHostProcessError } from '../../../adapters/projects-sessions/tracker-host-process-adapter/TrackerHostProcessError';
import { TrackerGmailSendAdapter } from '../../../adapters/projects-sessions/TrackerGmailSendAdapter';
import { TrackerOutgoingDriverAdapter } from '../../../adapters/projects-sessions/TrackerOutgoingDriverAdapter';
import { gmailNativeId } from '../../../adapters/projects-sessions/tracker-gmail-send-adapter/gmailDraftMime';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';
import type { TrackerOutgoingMessage } from '../../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerOutgoingSender } from '../TrackerOutgoingDraftService.types';
import type { TrackerNodeConfig } from './trackerNodeConfig.types';
import { readPrivateJson } from './trackerNodeConfig';

const name = z.string().trim().min(1).max(256);
const tokenDriver = z.string().min(1);
const gmailBinding = z.strictObject({ account: z.email(), tokenDriver });
const slackBinding = z.strictObject({
	account: name,
	host: z.string().regex(/^[a-z0-9-]+\.slack\.com$/),
	tokenDriver,
	installation: z.strictObject({
		installationId: name,
		workspaceId: name,
		botId: name,
		botUserId: name,
		project: z.literal('harness'),
		environment: z.enum(['development', 'staging', 'production'])
	}),
	destinations: z.array(channelId).min(1)
});
const githubBinding = z.strictObject({
	account: z.string().regex(/^[a-zA-Z0-9-]{1,39}$/),
	userId: z.int().positive(),
	repositories: z
		.array(z.string().regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/))
		.min(1),
	tokenDriver
});
const e164 = z.string().regex(/^\+[1-9][0-9]{6,14}$/);
const smsBinding = z.strictObject({
	accountSid: z.string().regex(/^AC[0-9a-f]{32}$/i),
	keySid: z.string().regex(/^SK[0-9a-f]{32}$/i),
	from: e164,
	destinations: z.array(e164).min(1),
	tokenDriver
});
const bindings = z.strictObject({
	github: z.array(githubBinding).default([]),
	sms: z.array(smsBinding).default([]),
	slack: z.array(slackBinding).default([]),
	drivers: z
		.array(
			z.strictObject({
				channel: z.enum(['imessage', 'sms', 'telegram', 'github-comment', 'post']),
				account: name,
				destinations: z.array(name).min(1),
				executable: name,
				receiptOrigins: z.array(z.url({ protocol: /^https$/ })).default([])
			})
		)
		.default([])
});

/** Only the Tracker hub resolves senders, using exact account and destination bindings. */
export function configuredOutgoingProvider(
	config: TrackerNodeConfig,
	paths: { gmail?: string; providers?: string }
): TrackerNativeRuntimeOptions['outgoingProvider'] {
	if (config.role !== 'hub' || config.hostEffects?.mode === 'held') return undefined;
	const gmail = paths.gmail
		? configuredGmail(gmailBinding.parse(readPrivateJson(paths.gmail)))
		: undefined;
	const others = paths.providers ? bindings.parse(readPrivateJson(paths.providers)) : null;
	const senders = others ? configuredSenders(others) : [];
	return (message) => {
		if (message.channel === 'gmail') return gmail?.(message);
		for (const resolve of senders) {
			const send = resolve(message);
			if (send) return send;
		}
		return undefined;
	};
}

function configuredSenders(config: z.infer<typeof bindings>) {
	const ids = [
		...config.slack.map(({ account }) => `slack:${account}`),
		...config.github.map(({ account }) => `github-comment:${account}`),
		...config.sms.map(({ from }) => `sms:${from}`),
		...config.drivers.map(({ channel, account }) => `${channel}:${account}`)
	];
	if (new Set(ids).size !== ids.length)
		throw new TypeError('Each outgoing channel and account requires one sender binding');
	return [
		...config.slack.map(configuredSlack),
		...config.github.map(({ tokenDriver, ...binding }) =>
			matchedSender(
				new TrackerGithubCommentAdapter({ ...binding, readAccessToken: readToken(tokenDriver) })
			)
		),
		...config.sms.map(({ tokenDriver, ...binding }) =>
			matchedSender(
				new TrackerSmsSendAdapter({ ...binding, readKeySecret: readToken(tokenDriver) })
			)
		),
		...config.drivers.map((binding) => matchedSender(new TrackerOutgoingDriverAdapter(binding)))
	];
}

function readToken(path: string) {
	const executable = controlledTrackerExecutable(path);
	return async (signal: AbortSignal) => {
		const result = await runTrackerHostCommand(executable, [], signal, { maxBuffer: 8192 });
		if (result.code !== 0) throw new TrackerHostProcessError('Sending credential unavailable');
		return result.stdout.trim();
	};
}

function configuredGmail({ account, tokenDriver }: z.infer<typeof gmailBinding>) {
	const adapter = new TrackerGmailSendAdapter({ account, readAccessToken: readToken(tokenDriver) });
	const send = adapter.send.bind(adapter);
	return (message: TrackerOutgoingMessage) =>
		message.channel === 'gmail' &&
		message.account === account &&
		(!message.thread || gmailNativeId(message.thread.id))
			? send
			: undefined;
}

function configuredSlack(binding: z.infer<typeof slackBinding>) {
	const token = readToken(binding.tokenDriver);
	const adapter = new SlackAdapter({
		installation: binding.installation,
		channels: binding.destinations,
		receive: 'none',
		vault: { withToken: async (_scope, use) => use(await token(AbortSignal.timeout(4_000))) },
		// The Tracker reservation and outcome are already journaled by the owner route.
		audit: async () => {}
	});
	const send: TrackerOutgoingSender = async ({ to, body, thread }) => {
		const posted = await adapter.send({ channelId: to[0], text: body, threadId: thread?.id });
		if (posted.status !== 'sent')
			return { kind: posted.status === 'unknown' ? 'unconfirmed' : 'failed' };
		const { channelId, messageId } = posted.receipt;
		const url = new URL(
			`https://${binding.host}/archives/${channelId}/p${messageId.replace('.', '')}`
		);
		if (thread) {
			url.searchParams.set('thread_ts', thread.id);
			url.searchParams.set('cid', channelId);
		}
		return { kind: 'sent', receipt: { reference: messageId, url: url.href } };
	};
	return (message: TrackerOutgoingMessage) =>
		message.channel === 'slack' &&
		message.account === binding.account &&
		binding.destinations.includes(message.to[0]) &&
		message.body.length <= 4000 &&
		(!message.thread || slackTimestamp.safeParse(message.thread.id).success)
			? send
			: undefined;
}

function matchedSender(adapter: {
	matches(message: TrackerOutgoingMessage): boolean;
	send: TrackerOutgoingSender;
}) {
	const send = adapter.send.bind(adapter);
	return (message: TrackerOutgoingMessage) => (adapter.matches(message) ? send : undefined);
}
