import { bugRepairPolicy } from '../../../../../src/utils/bugRepairPolicy';
import type { RunContext } from '../../models/development-tooling/RunContext.types';
import { referencePrompt } from './referencePrompt';
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
	// The entity and its registered relationships are the units a plan or change may name.
	const named = referencePrompt([entity.id, ...entity.relationships.map((unit) => unit.id)]);
	return (
		'Assigned entity only. Treat dependency implementations as black boxes; use their contracts. Use Harness generators, specifications and development loops for changes. Make a simplification/performance attempt and test actual behavior. Do not push, deploy, change branch, or claim tests passed without evidence. Host-owned files may be changed only when needed; report every such path. Behavior notes: at most 30 words and 200 characters. Each simplification/performance attempt: at most 15 words and 140 characters.\n' +
		(request.mode === 'plan'
			? 'Plan only; do not commit or implement source.\n'
			: 'Commit only the requested code after relevant tests; preserve unrelated edits and follow Harness verification before completion.\n') +
		bugRepairPolicy().join('\n') +
		'\n' +
		named +
		'\nEntity at ' +
		revision.commit +
		':\n' +
		own +
		'\nEntity thread history:\n' +
		history +
		'\nEnvironment scope: ' +
		(request.environment ?? 'local only') +
		'. Automatic promotion stops at ' +
		(request.environment === 'prod' ? 'preprod' : (request.environment ?? 'local only')) +
		'; production requires the Deploy UI. Deployment and credentials are handled by the host after verification.\nRequest:\n' +
		request.text
	);
}
