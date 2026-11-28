// @harness-uid u_ntk72qiuao
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
	appId,
	botId,
	channelId,
	teamId,
	userId
} from '../../../adapters/agents-providers/slack-adapter/slackWire';
import { ProjectAssistantConfigValidator } from '../../../validators/agents-providers/ProjectAssistantConfigValidator';
import { ProjectAssistantError } from '../../../core/agents-providers/ProjectAssistantError';

const ref = z.string().regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]{0,99}$/);
const publicChannel = channelId.refine((id) => !id.startsWith('D'));
const secureUrl = z.url().refine((value) => {
	const url = new URL(value);
	return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
});

const runner = z.strictObject({
	assistant: z.record(z.string(), z.unknown()),
	slack: z.strictObject({
		workspaceId: teamId,
		appId,
		botId,
		botUserId: userId
	}),
	model: z.string().regex(/^claude-[a-z0-9-]+$/),
	workspaceUrl: secureUrl.refine((value) => /^https:\/\/[a-z0-9-]+\.slack\.com\/?$/.test(value)),
	canvas: z
		.strictObject({
			title: z.string().min(1).max(80),
			branch: ref,
			directory: ref,
			allowedOrigins: z.array(secureUrl.refine((value) => new URL(value).origin === value)).max(10),
			channels: z.array(publicChannel).min(1).max(20)
		})
		.optional(),
	qa: z
		.strictObject({
			channel: publicChannel,
			label: z.string().min(1).max(80),
			stagingUrl: secureUrl.refine((value) => new URL(value).origin === value),
			checkName: z.string().min(1).max(80),
			checkApp: z.string().min(1).max(80),
			healthTarget: z.string().min(1).max(80),
			existingThreadIssues: z.array(z.number().int().positive()).max(500).optional(),
			trackerInbox: z
				.string()
				.regex(/^[a-z0-9]{6,12}$/)
				.optional()
		})
		.optional()
});

export async function readAssistantConfig(file: string) {
	try {
		const raw = runner.parse(JSON.parse(await readFile(file, 'utf8')));
		const assistant = new ProjectAssistantConfigValidator().parse(raw.assistant);
		const channels = [...(raw.canvas?.channels ?? []), ...(raw.qa ? [raw.qa.channel] : [])];
		if (channels.some((id) => !assistant.answerChannels.includes(id)))
			throw new ProjectAssistantError('Assistant input refused.');
		if (
			raw.qa &&
			!Object.values(assistant.health).some(
				(target) =>
					new URL(target).origin === raw.qa?.stagingUrl &&
					new URL(target).pathname === '/api/health'
			)
		)
			throw new ProjectAssistantError('Assistant input refused.');
		if (raw.canvas?.directory.split('/').some((part) => !part || part === '..' || part === '.'))
			throw new ProjectAssistantError('Assistant input refused.');
		return { ...raw, assistant, workspaceUrl: new URL(raw.workspaceUrl).origin };
	} catch {
		throw new ProjectAssistantError('Assistant config is unreadable or invalid.');
	}
}
