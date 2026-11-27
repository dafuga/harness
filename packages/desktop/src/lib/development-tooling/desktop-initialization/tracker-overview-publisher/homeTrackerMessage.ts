// @harness-uid u_zjp5ubofwd
import type {
	HomeChatInput,
	HomeChatReceipt,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { sanitizeText } from '$reports/lib/projects-sessions/project-overview/projectOverviewPrivacy';

const messagesUrl = 'http://127.0.0.1:7701/messages';

/**
 * Hands one Hub message to the Tracker, which types it into Chief of Staff's pane or the exact
 * run named. A run this computer does not show live for that agent's item is refused here.
 */
export async function deliverHomeMessage(
	input: HomeChatInput,
	home: Pick<OwnerHomeSnapshot, 'agents'>,
	fetcher: typeof fetch
): Promise<HomeChatReceipt> {
	const { id } = input;
	const target = messageTarget(input, home);
	const text = sanitizeText(input.text).trim();
	if (!target || !text || text.length > 2000) return { id, status: 'refused' };
	try {
		const response = await fetcher(messagesUrl, {
			method: 'POST',
			body: JSON.stringify({ id, target, text }),
			headers: { 'Content-Type': 'application/json', 'x-tracker-as': 'Daniel via Hub' },
			credentials: 'omit',
			redirect: 'error',
			signal: AbortSignal.timeout(4000)
		});
		const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
		if (!response.ok) return { id, status: response.status < 500 ? 'refused' : 'unconfirmed' };
		return typeof body?.id === 'string'
			? { id, status: 'sent', messageId: body.id }
			: { id, status: 'unconfirmed' };
	} catch {
		return { id, status: 'unconfirmed' };
	}
}

function messageTarget(input: HomeChatInput, home: Pick<OwnerHomeSnapshot, 'agents'>) {
	// Chief of Staff is always reachable: the Tracker keeps its chat even with no current item.
	if (input.agentId === 'cos') return input.itemId === 'cos' && !input.runId ? 'cos' : null;
	const agent = home.agents.find(
		(entry) => entry.id === input.agentId && entry.itemId === input.itemId
	);
	if (!agent?.runId || agent.runId !== input.runId) return null;
	const [node, run] = agent.runId.split('#');
	return { item: input.itemId, node, run: Number(run) };
}
