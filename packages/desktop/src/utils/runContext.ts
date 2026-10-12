import type { RunContext } from '../models/RunContext.types';
export async function runContext(context: RunContext): Promise<string> {
	const { entity, request, planning, revision } = context;
	const messages = await planning.messages(entity.id, request.threadId, revision.commit);
	const own = JSON.stringify({
		id: entity.id,
		title: entity.title,
		responsibility: entity.summary,
		contract: entity.contract,
		ownedSource: entity.sources,
		relationships: entity.relationships
	});
	const history = messages
		.slice(-20)
		.map((m) => m.author + ': ' + m.text.slice(0, 2000))
		.join('\n');
	return (
		'Assigned entity only. Treat dependency implementations as black boxes; use their contracts. Use Harness generators, specifications and development loops for changes. Make a simplification/performance attempt and test actual behavior. Do not commit, push, deploy, change branch, or claim tests passed without evidence. Host-owned files may be changed only when needed; report every such path. Behavior notes: at most 30 words and 200 characters. Each simplification/performance attempt: at most 15 words and 140 characters.\nEntity at ' +
		revision.commit +
		':\n' +
		own +
		'\nEntity thread history:\n' +
		history +
		'\nRequest:\n' +
		request.text
	);
}
