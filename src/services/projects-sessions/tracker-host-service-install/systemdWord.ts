// @harness-uid u_m4bik2yztq
/** @pure Quote one ExecStart word so systemd expands neither specifiers nor variables. */
export function systemdWord(word: string): string {
	const escaped = word
		.replaceAll('\\', '\\\\')
		.replaceAll('"', '\\"')
		.replaceAll('%', '%%')
		.replaceAll('$', () => '$$');
	return `"${escaped}"`;
}
