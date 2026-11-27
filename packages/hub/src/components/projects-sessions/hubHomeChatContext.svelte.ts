// @harness-uid u_7j4igv6rwg
import { getContext, setContext, tick } from 'svelte';
import type {
	HomeCosChatTarget,
	OpenHomeCosAsk,
	OpenHomeCosChat
} from './hubHomeChatContext.types';

const cosChatKey = Symbol('hub-home-cos-chat');

/** Provides the one Chief of Staff chat to every entry point on Home. */
export function provideHomeCosChat(refreshAsk?: () => void) {
	let target = $state.raw<HomeCosChatTarget | null>(null);
	const open: OpenHomeCosChat = (trigger, item) => {
		target = { trigger, item: item && { ...item } };
	};
	const openAsk: OpenHomeCosAsk = (trigger, askId) => {
		target = { trigger, askId };
		refreshAsk?.();
	};
	const chat = {
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
