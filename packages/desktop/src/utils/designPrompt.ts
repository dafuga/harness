import type { RunContext } from '../models/RunContext.types';
export function designPrompt(context: RunContext, prompt: string): string {
	const thread = context.entity.threads.find((t) => t.id === context.request.threadId);
	const region = thread?.region ? JSON.stringify(thread.region) : 'whole image';
	return (
		'Generate a realistic product design, matching the existing dark navy/gold Harness form factor. Top icon navbar: Pages, Shells, Components, Helpers, Configs, Services, Models. Branch/commit controls at the right. No Reports, no global Plan/App toggle. Model, CLI provider and Plan/Change controls belong inside the comment composer. Verification is only a check or X with tooltip. Source files only in Details → Source.\n' +
		'Entity: ' +
		context.entity.title +
		'. State: ' +
		(thread?.state ?? 'default') +
		'. Viewport: ' +
		(thread?.viewport ?? 'desktop') +
		'.\n' +
		'If a reference image is attached, revise it according to this feedback. Focus on normalized rectangle ' +
		region +
		'; preserve the other design decisions.\n' +
		prompt
	);
}
