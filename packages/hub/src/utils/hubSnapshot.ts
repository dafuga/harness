import type {
	Actor,
	CollaborationCache,
	ProjectSummary,
	SourceHistoryAdapter
} from 'collaboration';
import type { ProjectSnapshot } from '../../../desktop/src/models/Desktop.types';
import { hubSource } from './hubSource';
import { hubCatalog } from './hubCatalog';
import { hubFail, hubHash } from './hubJson';
import { hubProjectionCache } from './hubProjectionCache';
import { RemoteProjectResponseValidator } from '../../../desktop/src/validators/RemoteProjectResponseValidator';
export async function hubSnapshot(
	input: {
		actor: Actor;
		source: SourceHistoryAdapter;
		cache: CollaborationCache;
		project: ProjectSummary;
	},
	query: { branch: string | null; commit: string | null }
): Promise<ProjectSnapshot> {
	const { project, source } = input,
		branches = await source.branches(project.sourceRepository);
	const branch =
		branches.find((b) => b.name === query.branch) ||
		(query.branch ? null : (branches.find((b) => b.name === 'main') ?? branches[0]));
	if (!branch) return hubFail('not-found');
	const commit = query.commit ?? branch.tip,
		context = await hubSource({ ...input, ref: query.commit ?? `refs/heads/${branch.name}` });
	if (context.commit !== commit) return hubFail('revision-mismatch');
	return hubProjectionCache<ProjectSnapshot>(
		context,
		{
			profile: 'snapshot:' + (await hubHash(new TextEncoder().encode(JSON.stringify(branches)))),
			accept: (value) => new RemoteProjectResponseValidator().snapshot(value, project.id)
		},
		async () => {
			const commits = await source.commits(project.sourceRepository, {
				branch: branch.name,
				commit: query.commit ?? undefined
			});
			const catalog = await hubCatalog(context);
			return {
				project: { id: project.id, name: project.name, root: '' },
				revision: { branch: branch.name, commit, tip: branch.tip, atTip: commit === branch.tip },
				branches: branches.map((b) => ({ ...b, current: b.name === branch.name })),
				commits,
				entities: catalog.items,
				writable: false,
				capabilities: {
					comments: project.role !== 'viewer',
					agents: false,
					planning: false,
					approval: false,
					source: 'github'
				},
				cache: { identity: context.identity, status: 'fresh', publication: 'remote' }
			};
		}
	);
}
