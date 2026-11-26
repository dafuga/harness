// @harness-uid u_zjp5ubofwd
import type {
	HomeChatInput,
	HomeChatReceipt,
	HomeAgent
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { sanitizeText } from '$reports/lib/projects-sessions/project-overview/projectOverviewPrivacy';

const trackerOrigin = 'http://127.0.0.1:7701';

/** Checks the fresh projected current item, including the question, before one fixed Tracker write. */
export async function deliverHomeChat(
	input: HomeChatInput,
	agents: HomeAgent[],
	fetcher: typeof fetch = fetch
): Promise<HomeChatReceipt> {
	const agent = agents.find((entry) => entry.id === input.agentId);
	const path = chatPath(input, agent);
	const id = input.id;
	if (!path) return { id, status: 'refused' };
	const text = deliverableText(input, agent);
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
function deliverableText(input: HomeChatInput, agent: HomeAgent | undefined): string | null {
	const text = sanitizeText(input.text).trim();
	if (!text || text.length > 2000) return null;
	if (input.option !== undefined && !validTap(input, agent, text)) return null;
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
function validTap(input: HomeChatInput, agent: HomeAgent | undefined, text: string) {
	const chosen = agent?.options?.[(input.option ?? 0) - 1];
	if (!chosen || chosen.label !== text) return false;
	return !agent?.confirm || input.confirmed === true;
}

function chatPath(input: HomeChatInput, agent: HomeAgent | undefined) {
	if (!agent?.itemId || agent.itemId !== input.itemId || !/^[a-z0-9-]+$/i.test(input.itemId))
		return null;
	if (input.kind === 'answer' && (!agent.question || agent.question !== input.question))
		return null;
	if (input.kind !== 'answer' && input.kind !== 'note') return null;
	return `/items/${input.itemId}/${input.kind}`;
}
