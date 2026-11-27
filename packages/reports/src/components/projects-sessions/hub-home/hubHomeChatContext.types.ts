// @harness-uid u_afmcviqipo
export interface HomeChatItemContext {
	id: string;
	title: string;
	details?: string;
}

export type OpenHomeCosChat = (trigger: HTMLElement, item?: HomeChatItemContext) => void;

export type OpenHomeCosAsk = (trigger: HTMLElement, itemId: string) => void;

export interface HomeCosChatTarget {
	trigger: HTMLElement;
	item?: HomeChatItemContext;
	askId?: string;
}
