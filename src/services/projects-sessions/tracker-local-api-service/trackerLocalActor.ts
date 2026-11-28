// @harness-uid u_g7kdpz7bel
export function readActor(headers: Headers): string | null {
	const actor = headers
		.get('x-tracker-as')
		?.replace(/[^\P{Cc}\u0080-\u009f]/gu, '')
		.trim()
		.slice(0, 80);
	if (!actor) return null;
	return actor;
}
