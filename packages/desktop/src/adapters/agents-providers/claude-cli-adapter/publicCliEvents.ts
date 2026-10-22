/** Allowlist public assistant text. Private reasoning and tool bodies never cross IPC. */
export function publicCliEvents(value: unknown): string[] {
	if (!value || typeof value !== 'object') return [];
	const event = value as Record<string, unknown>;
	if (event.type !== 'assistant' || !event.message || typeof event.message !== 'object') return [];
	const content = (event.message as Record<string, unknown>).content;
	if (!Array.isArray(content)) return [];
	return content.flatMap((item: unknown) => {
		if (!item || typeof item !== 'object') return [];
		const part = item as Record<string, unknown>;
		return part.type === 'text' && typeof part.text === 'string' ? [part.text] : [];
	});
}
