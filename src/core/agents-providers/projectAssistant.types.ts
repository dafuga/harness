// @harness-uid u_kg5hqa2cde
/** One project's assistant, described entirely by configuration. */
export interface ProjectAssistantConfig {
	project: string;
	displayName: string;
	github: {
		owner: string;
		repo: string;
		appId: string;
		installationId: string;
		/** Branch that holds the deployed staging revision. */
		stagingBranch: string;
		mainBranch: string;
	};
	tracker: { agent: string; owner: string };
	/** Named health URLs the assistant may fetch (HTTPS only). */
	health: Readonly<Record<string, string>>;
	/** Slack user ids that may ask the assistant to create issues or tracker items. */
	writers: readonly string[];
	/** Channel ids where the assistant answers when mentioned. */
	answerChannels: readonly string[];
	answerDirectMessages: boolean;
}

export interface AssistantSource {
	label: string;
	url: string;
}

export interface AssistantToolResult {
	/** Compact text the model reads. Untrusted, redacted before use. */
	text: string;
	sources: readonly AssistantSource[];
}

export interface AssistantToolDefinition {
	name: string;
	description: string;
	/** JSON schema for the tool input. */
	input: Readonly<Record<string, unknown>>;
	/** Write tools run only for configured writers. */
	write: boolean;
	run(input: Readonly<Record<string, unknown>>): Promise<AssistantToolResult>;
}

export interface AssistantQuestion {
	allowWrite?: boolean;
	text: string;
	senderId: string;
	channelId: string;
	history?: readonly { role: 'user' | 'assistant'; content: string }[];
}

export interface AssistantAnswer {
	text: string;
	sources: readonly AssistantSource[];
	toolCalls: readonly string[];
}

/** Any decoded JSON value or untrusted input. */
export type UntrustedValue = string | number | boolean | null | undefined | object;
