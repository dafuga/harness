// @harness-uid u_6jngysfyen
export interface SlackUserBinding {
	workspaceId: string;
	userId: string;
}

export interface SlackUserAdapterConfig {
	binding: SlackUserBinding;
	withToken<T>(use: (token: string) => Promise<T>): Promise<T>;
	allowsChannel(channelId: string): boolean;
	fetch?: typeof fetch;
}

export interface SlackUserMessage {
	ts: string;
	text: string;
	user?: string;
	threadTs?: string;
}

export interface SlackUserMessagePage {
	messages: SlackUserMessage[];
	nextCursor: string | null;
	hasMore: boolean;
}

export interface SlackUserConversationPage {
	conversations: { id: string; name: string }[];
	nextCursor: string | null;
}
