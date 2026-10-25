import { hubModuleData } from '../../../../utils/development-tooling/hubModuleData';
import type { Dependencies } from './HubProjectionService.types';
import { HubEvidenceService } from './hub-evidence-service/HubEvidenceService';
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../../../../../desktop/src/models/DesktopEvidence.types';
import { hubHistory } from '../../../../utils/git-source-history/hubHistory';
import type { Actor } from 'collaboration';
import type { ThreadMessage } from '../../../../../../desktop/src/models/Desktop.types';
import { hubSource, hubRead } from '../../../../utils/development-tooling/hubSource';
import type { HubSourceContext } from '../../../../utils/development-tooling/hubSource';
import {
	hubCatalog,
	hubOwnedPaths,
	hubAttestPlan
} from '../../../../utils/networking-security/hub-catalog/hubCatalog';
import { hubRecords } from '../../../../utils/development-tooling/hubRecords';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
import { hubMessages } from './hubThreads';
import { hubThreads } from '../../../../utils/networking-security/hubThreads';
import { hubPlans } from '../../../../utils/networking-security/hubPlans';
import { hubDesignImage } from './hubDesigns';
import { hubSnapshot } from './hubSnapshot';
import { hubEntity } from './hubEntity';
import { hubProjectionCache } from '../../../../utils/development-tooling/hubProjectionCache';
import { RemoteProjectResponseValidator } from '../../../../../../desktop/src/validators/RemoteProjectResponseValidator';

export class HubProjectionService {
	private readonly recorded: HubEvidenceService;
	constructor(private context: Dependencies) {
		this.recorded = new HubEvidenceService(context);
	}
	evidence(actor: Actor, projectId: string, query: EntityEvidenceQuery) {
		return this.recorded.evidence(actor, projectId, query);
	}
	artifact(actor: Actor, projectId: string, query: EvidenceArtifactQuery) {
		return this.recorded.artifact(actor, projectId, query);
	}

	async snapshot(
		actor: Actor,
		projectId: string,
		query: { branch: string | null; commit: string | null }
	) {
		const project = await this.context.api.getProject(actor, projectId);
		return hubSnapshot({ ...this.context, actor, project }, query);
	}
	async moduleData(actor: Actor, projectId: string, commit: string | null, branch?: string | null) {
		return hubModuleData(
			await loadProjection(this.context, { actor, projectId, ref: commit, branch })
		);
	}
	async registry(actor: Actor, projectId: string, commit: string) {
		return readRegistry(await loadProjection(this.context, { actor, projectId, ref: commit }));
	}
	async entity(
		actor: Actor,
		projectId: string,
		query: { entityId: string; commit: string; branch: string }
	) {
		const context = await loadProjection(this.context, { actor, projectId, ref: query.commit });
		const shared = await this.context.api.listThreads(actor, {
			projectId,
			entityId: query.entityId,
			commit: query.commit
		});
		const entity = await hubProjectionCache(
			context,
			{
				profile: 'entity:' + query.entityId,
				accept: (value) => new RemoteProjectResponseValidator().entity(value, query.entityId)
			},
			() => hubEntity(context, { ...query, shared: [] })
		);
		return { ...entity, threadCount: shared.length, threads: hubThreads(shared) };
	}
	async history(
		actor: Actor,
		projectId: string,
		query: { entityId: string; commit: string; page: number; branch: string }
	) {
		const context = await loadProjection(this.context, { actor, projectId, ref: query.commit }),
			data = await hubCatalog(context);
		const unit = data.units.find((u) => u.id === query.entityId),
			plan = data.plans.find((p) => p.unitId === query.entityId);
		if (!unit && !plan) return hubFail('not-found');
		return hubProjectionCache(
			context,
			{
				profile: `history:${query.entityId}:${query.page}`,
				accept: (value) => new RemoteProjectResponseValidator().history(value)
			},
			() =>
				hubHistory(context, {
					page: query.page,
					branch: query.branch,
					paths: [...(unit ? unit.owns.source : []), ...(plan ? [plan.path] : [])]
				})
		);
	}
	async source(
		actor: Actor,
		projectId: string,
		query: { entityId: string; commit: string; path: string }
	) {
		return readSource(
			await loadProjection(this.context, { actor, projectId, ref: query.commit }),
			query
		);
	}
	async image(
		actor: Actor,
		projectId: string,
		query: {
			entityId: string;
			commit: string;
			version: string;
			sha256: string;
		}
	) {
		const context = await loadProjection(this.context, { actor, projectId, ref: query.commit }),
			plan = (await hubPlans(context)).find((p) => p.unitId === query.entityId);
		if (!plan) return hubFail('not-found');
		hubAttestPlan(
			plan,
			(await hubRecords(context)).find((u) => u.id === plan.unitId)
		);
		return hubDesignImage(context, plan, query);
	}
	async messages(
		actor: Actor,
		projectId: string,
		query: { entityId: string; commit: string; threadId: string }
	): Promise<ThreadMessage[]> {
		const thread = (
			await this.context.api.listThreads(actor, {
				projectId,
				entityId: query.entityId,
				commit: query.commit
			})
		).find((t) => t.id === query.threadId);
		if (!thread) return hubFail('not-found');
		return hubMessages(thread);
	}
}

async function readRegistry(context: HubSourceContext) {
	return { commit: context.commit, units: await hubRecords(context) };
}

async function defaultModuleRef(
	context: Dependencies,
	repository: Parameters<Dependencies['source']['branches']>[0],
	name?: string | null
): Promise<string> {
	const branches = await context.source.branches(repository);
	const branch = name
		? branches.find((item) => item.name === name)
		: (branches.find((item) => item.name === 'main') ?? branches[0]);
	if (!branch) return hubFail('not-found');
	return `refs/heads/${branch.name}`;
}

async function loadProjection(
	context: Dependencies,
	input: { actor: Actor; projectId: string; ref: string | null; branch?: string | null }
) {
	const project = await context.api.getProject(input.actor, input.projectId);
	const selected =
		input.ref ?? (await defaultModuleRef(context, project.sourceRepository, input.branch));
	return hubSource({ ...context, actor: input.actor, project, ref: selected });
}

async function readSource(context: HubSourceContext, query: { entityId: string; path: string }) {
	const data = await hubCatalog(context),
		unit = data.units.find((item) => item.id === query.entityId);
	if (!unit || !hubOwnedPaths(context, unit).includes(query.path)) return hubFail('forbidden');
	return { path: query.path, text: new TextDecoder().decode(await hubRead(context, query.path)) };
}
