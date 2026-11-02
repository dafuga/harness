// @harness-uid u_suu3cz4j5c
/** The compiled console: one script and one stylesheet, as text. */
export interface ConsoleAssets {
	script: string;
	style: string;
}

export interface ConsoleDocumentOptions {
	/** Path the host serves the console under, for example `/harness`. */
	base: string;
	title?: string;
	links?: Array<{ label: string; href: string }>;
}
