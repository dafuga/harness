// @harness-uid u_7j4igv6rwg
import { SvelteMap } from 'svelte/reactivity';
import type { HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { getContext, setContext, tick } from 'svelte';
import type {
	HomeCosChatTarget,
	OpenHomeCosAsk,
	OpenHomeCosChat
} from './hubHomeChatContext.types';
import type {
	HomeOutgoingAction,
	HomeOutgoingActions,
	HomeOutgoingDraft,
	HomeOutgoingSource
} from './hubHomeOutgoingDraft.types';

const cosChatKey = Symbol('hub-home-cos-chat');

/** An answer belongs to this question, including when Tracker reuses its item id. */
export const askKey = (ask: HomeOpenAsk) => JSON.stringify([ask.itemId, ask.question, ask.since]);

/** Provides the one Chief of Staff chat to every entry point on Home. */
export function provideHomeCosChat(
	refreshAsk?: () => void,
	outgoingSource?: () => HomeOutgoingSource | undefined
) {
	let target = $state.raw<HomeCosChatTarget | null>(null);
	const open: OpenHomeCosChat = (trigger, item) => {
		target = { trigger, item: item && { ...item } };
	};
	const openAsk: OpenHomeCosAsk = (trigger, askId) => {
		target = { trigger, askId };
		refreshAsk?.();
	};
	const answers = new SvelteMap<
		string,
		{ ask: HomeOpenAsk; status: string; selection?: number; dismissed: boolean }
	>();
	const outgoing = outgoingSource && followOutgoing(outgoingSource, () => target !== null);
	const chat = {
		answers,
		outgoing,
		get target() {
			return target;
		},
		open,
		openAsk,
		close() {
			const trigger = target?.trigger;
			target = null;
			void tick().then(() => trigger?.focus());
		}
	};
	return setContext(cosChatKey, chat);
}

/** Scheduled and other Home views can call .open(trigger, item) to attach an item to the chat. */
export function homeCosChat() {
	return getContext<ReturnType<typeof provideHomeCosChat> | undefined>(cosChatKey);
}

/** Observe drafts only in open chat. A closed chat or a changed session drops old responses. */
function followOutgoing(source: () => HomeOutgoingSource | undefined, opened: () => boolean) {
	let active = $state.raw<HomeOutgoingActions>();
	let unavailable = $state(false);
	$effect(() => {
		const owner = source();
		active = undefined;
		unavailable = false;
		if (!owner || !opened()) return;
		const gateway = owner;
		let disposed = false;
		let reading = false;
		let generation = 0;
		const current = () => !disposed && source() === owner;
		async function read() {
			if (reading) return;
			reading = true;
			const requested = generation;
			try {
				const drafts = await gateway.read();
				if (!Array.isArray(drafts)) throw new TypeError('Unexpected outgoing drafts.');
				if (current() && requested === generation) {
					active = actions(drafts.slice().reverse(), write);
					unavailable = false;
				}
			} catch {
				if (current() && requested === generation) {
					active = undefined;
					unavailable = true;
				}
			} finally {
				reading = false;
			}
		}
		async function write(action: HomeOutgoingAction) {
			if (!current() || !active) throw new Error('Draft review is unavailable.');
			generation++;
			try {
				const result = await gateway.write(action);
				if (current() && active) active = actions(replaceDraft(active.drafts, result), write);
			} finally {
				generation++;
				if (current()) void read();
			}
		}
		void read();
		const timer = setInterval(() => {
			if (!document.hidden) void read();
		}, 5000);
		return () => {
			disposed = true;
			clearInterval(timer);
		};
	});
	return {
		get actions() {
			return active;
		},
		get unavailable() {
			return unavailable;
		}
	};
}

function actions(
	drafts: readonly HomeOutgoingDraft[],
	write: (action: HomeOutgoingAction) => Promise<void>
): HomeOutgoingActions {
	return {
		drafts,
		send: (version) => write({ ...version, action: 'send' }),
		discard: (version) => write({ ...version, action: 'discard' }),
		edit: (version, message) => write({ ...version, action: 'edit', message })
	};
}

function replaceDraft(drafts: readonly HomeOutgoingDraft[], changed: HomeOutgoingDraft) {
	return drafts.map((draft) =>
		draft.id === changed.id && draft.revision <= changed.revision
			? { ...changed, canSend: changed.canSend ?? draft.canSend }
			: draft
	);
}
