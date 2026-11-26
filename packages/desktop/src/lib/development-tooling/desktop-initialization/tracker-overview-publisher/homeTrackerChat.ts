// @harness-uid u_zjp5ubofwd
import type {
	HomeChatInput,
	HomeChatReceipt,
	HomeAgent,
	HomeOpenAsk,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { sanitizeText } from '$reports/lib/projects-sessions/project-overview/projectOverviewPrivacy';

const trackerOrigin = 'http://127.0.0.1:7701';

/** Checks the fresh projected item, including the question, before one fixed Tracker write. */
export async function deliverHomeChat(
	input: HomeChatInput,
	home: Pick<OwnerHomeSnapshot, 'agents' | 'openAsks'>,
	fetcher: typeof fetch = fetch
): Promise<HomeChatReceipt> {
	const ask = home.openAsks?.find(
		(entry) => entry.itemId === input.itemId && entry.agentId === input.agentId
	);
	const path = chatPath(input, home.agents, ask);
	const id = input.id;
	if (!path) return { id, status: 'refused' };
	const text = deliverableText(input, ask);
	if (text === null) return { id, status: 'refused' };
	const body = chatBody(input, text);
	try {
		const response = await fetcher(trackerOrigin + path, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'Content-Type': 'application/json' },
			credentials: 'omit',
			redirect: 'error',
			signal: AbortSignal.timeout(4000)
		});
		await response.body?.cancel();
		return { id, status: deliveryStatus(response) };
	} catch {
		return { id, status: 'unconfirmed' };
	}
}

/** The sanitized text to write, or null when it or the tapped option does not fit the ask. */
function deliverableText(input: HomeChatInput, ask: HomeOpenAsk | undefined): string | null {
	const text = sanitizeText(input.text).trim();
	if (!text || text.length > 2000) return null;
	if (input.option !== undefined && !validTap(input, ask, text)) return null;
	return text;
}

function deliveryStatus(response: Response): HomeChatReceipt['status'] {
	if (response.ok) return 'sent';
	return response.status < 500 ? 'refused' : 'unconfirmed';
}

function chatBody(input: HomeChatInput, text: string) {
	if (input.kind !== 'answer') return { text: 'Hub message: ' + text };
	const by = 'Daniel via Hub';
	return input.option === undefined
		? { answer: text, by }
		: { option: input.option, confirmed: input.confirmed === true, by };
}

/** A tap names one of the open ask's own options, and a deploy, money or secret ask is confirmed. */
function validTap(input: HomeChatInput, ask: HomeOpenAsk | undefined, text: string) {
	const chosen = ask?.options[(input.option ?? 0) - 1];
	if (!chosen || chosen.label !== text) return false;
	return !ask?.confirm || input.confirmed === true;
}

/** An answer goes to an open ask; a note goes to its agent's current item. */
function chatPath(input: HomeChatInput, agents: HomeAgent[], ask: HomeOpenAsk | undefined) {
	if (!/^[a-z0-9-]+$/i.test(input.itemId)) return null;
	const open =
		input.kind === 'answer'
			? ask?.question === input.question
			: input.kind === 'note' &&
				agents.some((entry) => entry.id === input.agentId && entry.itemId === input.itemId);
	return open ? `/items/${input.itemId}/${input.kind}` : null;
}
