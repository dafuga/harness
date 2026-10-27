import type { RunContext } from '../../models/development-tooling/RunContext.types';
export function designPrompt(
	context: RunContext,
	prompt: string,
	referenceAttached: boolean
): string {
	const thread = context.entity.threads.find((t) => t.id === context.request.threadId);
	const request = context.request.text || prompt;
	const location =
		referenceAttached && thread?.region
			? `The selected edit region is the normalized rectangle ${JSON.stringify(thread.region)}.`
			: 'Identify the requested edit area from the user request; do not assume the whole page is changing.';
	const reference = referenceAttached
		? 'Use the attached reference as the starting point. Change only the requested area. Preserve everything outside the requested area exactly as shown, including layout, text, colors, typography, navigation, images, and other controls. Keep the full framing and dimensions; do not restyle, move, crop, or replace unrelated parts.'
		: 'No reference image is available. Follow the request and supplied context without inventing an existing page to preserve.';
	return [
		`Create a realistic product design. Entity: ${context.entity.title}. State: ${thread?.state ?? 'default'}. Viewport: ${thread?.viewport ?? 'desktop'}.`,
		reference,
		location,
		'If the user explicitly requests a whole-page redesign, the whole page is the requested area.',
		`Original user request (authoritative for the edit scope):\n${request}`,
		`Planning proposal (do not expand the requested scope):\n${prompt}`
	].join('\n');
}
