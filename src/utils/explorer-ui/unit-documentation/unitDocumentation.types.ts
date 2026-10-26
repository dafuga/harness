export interface UsageExample {
	name: string;
	description?: string;
	/** Authored invocations are displayed as text and never executed by the viewer. */
	call?: string;
	input: unknown;
	output?: unknown;
	returns?: 'void';
	error?: unknown;
}

export interface UnitDocumentation {
	path: string;
	/** Original Markdown, retained verbatim for review; never rendered as HTML. */
	text?: string;
	setup?: string;
	examples: UsageExample[];
	gap?: string;
}
