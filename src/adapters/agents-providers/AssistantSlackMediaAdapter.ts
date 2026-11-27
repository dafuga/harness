// @harness-uid u_sceg2tkujc
import { z } from 'zod';
import type {
	AssistantSlackHistoryRow,
	AssistantSlackMediaAdapterConfig
} from './AssistantSlackMediaAdapter.types';
import { SlackRequestError } from './slack-adapter/SlackRequestError';
import { SlackWebApi } from './slack-adapter/SlackWebApi';
import { slackTimestamp } from './slack-adapter/slackWire';

const fileId = z.string().regex(/^F[A-Z0-9]{1,63}$/);
const uploadReply = z.object({ file_id: fileId, upload_url: z.string() });
const historyReply = z.object({
	messages: z.array(z.object({ ts: slackTimestamp, text: z.string() }))
});

export class AssistantSlackMediaAdapter {
	private readonly api: SlackWebApi;

	constructor(private readonly binding: AssistantSlackMediaAdapterConfig) {
		this.api = new SlackWebApi({ ...binding, receive: 'none' });
	}

	async upload(
		channel: string,
		thread: string,
		video: Uint8Array<ArrayBuffer>,
		steps: string
	): Promise<void> {
		this.requireChannel(channel);
		if (!slackTimestamp.safeParse(thread).success || !video.length || video.length > 40_000_000)
			throw new SlackRequestError('invalid-message');
		const filename = 'staging-qa.mp4';
		const request = uploadReply.safeParse(
			await this.api.assistantCommand('files.getUploadURLExternal', {
				filename,
				length: video.length
			})
		);
		const url = request.success && URL.parse(request.data.upload_url);
		if (!request.success || !url || !validUploadUrl(url))
			throw new SlackRequestError('provider-refused');
		await uploadBytes(url, video);
		await this.api.assistantCommand('files.completeUploadExternal', {
			files: [{ id: request.data.file_id, title: 'Staging QA walkthrough' }],
			channel_id: channel,
			thread_ts: thread,
			initial_comment: steps
		});
	}

	async create(title: string, markdown: string): Promise<string> {
		const result = await this.api.assistantCommand('canvases.create', {
			title,
			document_content: { type: 'markdown', markdown }
		});
		const created = z.object({ canvas_id: fileId }).safeParse(result);
		if (!created.success) throw new SlackRequestError('delivery-unknown');
		return created.data.canvas_id;
	}

	async replace(id: string, markdown: string): Promise<void> {
		await this.api.assistantCommand('canvases.edit', {
			canvas_id: fileId.parse(id),
			changes: [{ operation: 'replace', document_content: { type: 'markdown', markdown } }]
		});
	}

	async share(id: string, channels: readonly string[]): Promise<void> {
		channels.forEach((channel) => this.requireChannel(channel));
		await this.api.assistantCommand('canvases.access.set', {
			canvas_id: fileId.parse(id),
			access_level: 'read',
			channel_ids: channels
		});
	}

	async history(channel: string): Promise<readonly AssistantSlackHistoryRow[]> {
		this.requireChannel(channel);
		const result = historyReply.safeParse(
			await this.api.assistantCommand('conversations.history', { channel, limit: 15 })
		);
		if (!result.success) throw new SlackRequestError('provider-refused');
		return result.data.messages;
	}

	private requireChannel(channel: string): void {
		if (!/^[CG][A-Z0-9]{1,63}$/.test(channel) || !this.binding.channels.includes(channel))
			throw new SlackRequestError('denied');
	}
}

function validUploadUrl(url: URL): boolean {
	return (
		url.origin === 'https://files.slack.com' &&
		url.pathname.startsWith('/upload/') &&
		!url.username &&
		!url.password &&
		!url.hash
	);
}

async function uploadBytes(url: URL, video: Uint8Array<ArrayBuffer>): Promise<void> {
	try {
		const reply = await fetch(url, {
			method: 'POST',
			redirect: 'error',
			signal: AbortSignal.timeout(90_000),
			headers: { 'content-type': 'application/octet-stream' },
			body: video
		});
		if (!reply.ok) throw new SlackRequestError('provider-refused');
	} catch {
		throw new SlackRequestError('provider-unavailable');
	}
}
