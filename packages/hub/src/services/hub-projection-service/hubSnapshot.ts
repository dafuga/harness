import type {
	Actor,
	CollaborationCache,
	ProjectSummary,
	SourceHistoryAdapter
} from 'collaboration';
import type { ProjectSnapshot } from '../../../../desktop/src/models/Desktop.types';
import { hubSource } from '../../utils/hubSource';
import { hubCatalog } from '../../utils/hub-catalog/hubCatalog';
import { hubFail, hubHash } from '../../utils/hubJson';
import { hubProjectionCache } from '../../utils/hubProjectionCache';
import { RemoteProjectResponseValidator } from '../../../../desktop/src/validators/RemoteProjectResponseValidator';
import { githubRepositoryUrl } from '../../../../../src/utils/githubSourceUrl';

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
	const snapshot = await hubProjectionCache<ProjectSnapshot>(
		context,
		{
			// Named for what is listed: a snapshot cached with route loaders in it is not read.
			profile:
				'snapshot:pure-helper-contracts-v1:' +
				(await hubHash(new TextEncoder().encode(JSON.stringify(branches)))),
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
				entities: catalog.listed,
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
	// Repository context also reaches snapshots cached before file links were introduced.
	return { ...snapshot, project: snapshotProject(project) };
}

/** @pure The public identity of the already-authorized project, without credentials. */
function snapshotProject(project: ProjectSummary): ProjectSnapshot['project'] {
	const { owner, name } = project.sourceRepository;
	return {
		id: project.id,
		name: project.name,
		root: '',
		repositoryUrl: githubRepositoryUrl(`https://github.com/${owner}/${name}`)
	};
}
