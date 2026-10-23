/** The compiled console: one script and one stylesheet, as text. */
export interface ConsoleAssets {
	script: string;
	style: string;
}

export interface ConsoleDocumentOptions {
	/** Path the host serves the console under, for example `/harness`. */
	base: string;
	title?: string;
	/** True only when the host also serves `<base>/export/<commit>`. */
	exportable?: boolean;
	links?: Array<{ label: string; href: string }>;
}
