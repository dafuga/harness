// @harness-uid u_mpr47pwba7
import { z } from 'zod';
import type { TrackerMessageMatch } from '../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterReadQuery,
	TrackerMessageCandidate
} from '../../services/projects-sessions/TrackerAdapterPollService.types';
import type { TrackerGmailAdapterConfig } from './TrackerGmailAdapter.types';

const gmailApi = 'https://gmail.googleapis.com/gmail/v1/users/me/';
const gmailId = z.string().regex(/^[a-z0-9_-]{1,128}$/);
const profile = z.object({ emailAddress: z.string() });
const page = z.object({
	messages: z.array(z.object({ id: gmailId, threadId: gmailId })).default([]),
	nextPageToken: z.string().min(1).optional()
});
const metadata = z.object({
	id: gmailId,
	threadId: gmailId,
	internalDate: z.string().regex(/^\d+$/).transform(Number).pipe(z.int().nonnegative()),
	labelIds: z.array(z.string()).default([]),
	payload: z
		.object({ headers: z.array(z.object({ name: z.string(), value: z.string() })).default([]) })
		.optional()
});

export type { TrackerGmailAdapterConfig } from './TrackerGmailAdapter.types';

/** Read Gmail candidates without fetching message bodies, subjects or snippets. */
export class TrackerGmailAdapter {
	constructor(
		private readonly config: TrackerGmailAdapterConfig,
		private readonly transport: (url: string, options: RequestInit) => Promise<Response> = fetch
	) {}

	async *read(
		match: Readonly<TrackerMessageMatch>,
		query: TrackerAdapterReadQuery
	): AsyncGenerator<TrackerMessageCandidate> {
		const signal = AbortSignal.any([query.signal, AbortSignal.timeout(55_000)]);
		const token = await this.config.readAccessToken(signal);
		if (!/^[A-Za-z0-9._~-]{1,4096}$/.test(token)) throw unavailable();
		const get = gmailGet(this.transport, token, signal);
		const identity = profile.safeParse(await get('profile?fields=emailAddress'));
		if (
			!identity.success ||
			identity.data.emailAddress.toLowerCase() !== this.config.account.toLowerCase()
		)
			throw unavailable();
		yield* gmailCandidates(get, match, query);
	}
}

function gmailGet(
	transport: (url: string, options: RequestInit) => Promise<Response>,
	token: string,
	signal: AbortSignal
) {
	return async (path: string): Promise<unknown> => {
		try {
			const response = await transport(gmailApi + path, {
				method: 'GET',
				headers: { authorization: `Bearer ${token}` },
				redirect: 'error',
				signal
			});
			if (response.ok) return await response.json();
		} catch {
			// Never forward request details or a provider response into Tracker logs.
		}
		throw unavailable();
	};
}

async function* gmailCandidates(
	get: ReturnType<typeof gmailGet>,
	match: Readonly<TrackerMessageMatch>,
	{ since }: TrackerAdapterReadQuery
) {
	const seen = new Set<string>();
	const search = `after:${Math.max(0, Math.floor((since - 1) / 1000))} -in:sent -in:drafts`;
	if (match.keyword) {
		if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} _'-]{0,119}$/u.test(match.keyword)) throw unavailable();
		yield* readGmailSearch(get, `${search} "${match.keyword}"`, seen, {
			match,
			keywordMatched: true
		});
	}
	if (match.senders.length || match.domains.length || match.threads.length)
		yield* readGmailSearch(get, search, seen, { match, keywordMatched: false });
}

async function* readGmailSearch(
	get: ReturnType<typeof gmailGet>,
	search: string,
	seen: Set<string>,
	{ match, keywordMatched }: { match: Readonly<TrackerMessageMatch>; keywordMatched: boolean }
) {
	const hasAddressMatcher = Boolean(match.senders.length || match.domains.length);
	for await (const { id, threadId } of listGmailMessages(get, search)) {
		if (seen.has(id)) continue;
		if (!keywordMatched && !hasAddressMatcher && !match.threads.includes(threadId)) continue;
		const message = await readGmailMetadata(get, id, threadId, keywordMatched);
		seen.add(id);
		if (message) yield message;
	}
}

async function* listGmailMessages(get: ReturnType<typeof gmailGet>, search: string) {
	const tokens = new Set<string>();
	const query = new URLSearchParams({
		q: search,
		maxResults: '100',
		fields: 'messages(id,threadId),nextPageToken'
	});
	do {
		const result = page.safeParse(await get(`messages?${query}`));
		if (!result.success) throw unavailable();
		yield* result.data.messages;
		const next = result.data.nextPageToken;
		if (!next) return;
		if (tokens.has(next)) throw unavailable();
		tokens.add(next);
		query.set('pageToken', next);
	} while (true);
}

async function readGmailMetadata(
	get: ReturnType<typeof gmailGet>,
	id: string,
	threadId: string,
	keywordMatched: boolean
): Promise<TrackerMessageCandidate | undefined> {
	const query = new URLSearchParams({
		format: 'metadata',
		metadataHeaders: 'From',
		fields: 'id,threadId,internalDate,labelIds,payload(headers(name,value))'
	});
	const result = metadata.safeParse(await get(`messages/${id}?${query}`));
	if (!result.success || result.data.id !== id || result.data.threadId !== threadId)
		throw unavailable();
	const message = result.data;
	if (message.labelIds.some((label) => ['SENT', 'DRAFT', 'SPAM', 'TRASH'].includes(label)))
		return undefined;
	const senders =
		message.payload?.headers.filter(({ name }) => name.toLowerCase() === 'from') ?? [];
	return {
		id,
		threadId,
		receivedAt: message.internalDate,
		keywordMatched,
		...(senders.length === 1 && { sender: gmailSender(senders[0].value) })
	};
}

function gmailSender(header: string): string | undefined {
	const address = (header.match(/^[^<>]*<([^<>]+)>\s*$/)?.[1] ?? header).trim().toLowerCase();
	return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$/.test(address) ? address : undefined;
}

function unavailable(): Error {
	return new Error('Gmail read unavailable');
}
