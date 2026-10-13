import { HubEvidenceService } from './HubEvidenceService';
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../../desktop/src/models/DesktopEvidence.types';
import { hubHistory } from '../utils/hubHistory';
import type {
	Actor,
	CollaborationApi,
	CollaborationCache,
	SourceHistoryAdapter
} from 'collaboration';
import type { ThreadMessage } from '../../../desktop/src/models/Desktop.types';
import { hubSource, hubRead } from '../utils/hubSource';
import { hubCatalog, hubOwnedPaths, hubAttestPlan } from '../utils/hubCatalog';
import { hubRecords } from '../utils/hubRecords';
import { hubFail } from '../utils/hubJson';
import { hubMessages, hubThreads } from '../utils/hubThreads';
import { hubPlans } from '../utils/hubPlans';
import { hubDesignImage } from '../utils/hubDesigns';
import { hubSnapshot } from '../utils/hubSnapshot';
import { hubEntity } from '../utils/hubEntity';
import { hubProjectionCache } from '../utils/hubProjectionCache';
import { RemoteProjectResponseValidator } from '../../../desktop/src/validators/RemoteProjectResponseValidator';
interface Dependencies {
	api: CollaborationApi;
	source: SourceHistoryAdapter;
	cache: CollaborationCache;
}
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
	private async load(actor: Actor, projectId: string, ref: string) {
		const project = await this.context.api.getProject(actor, projectId);
		return hubSource({ ...this.context, actor, project, ref });
	}
	async snapshot(
		actor: Actor,
		projectId: string,
		query: { branch: string | null; commit: string | null }
	) {
		const project = await this.context.api.getProject(actor, projectId);
		return hubSnapshot({ ...this.context, actor, project }, query);
	}
	async entity(
		actor: Actor,
		projectId: string,
		query: { entityId: string; commit: string; branch: string }
	) {
		const context = await this.load(actor, projectId, query.commit);
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
		const context = await this.load(actor, projectId, query.commit),
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
		const context = await this.load(actor, projectId, query.commit),
			data = await hubCatalog(context),
			unit = data.units.find((u) => u.id === query.entityId);
		if (!unit || !hubOwnedPaths(context, unit).includes(query.path)) return hubFail('forbidden');
		return {
			path: query.path,
			text: new TextDecoder().decode(await hubRead(context, query.path))
		};
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
		const context = await this.load(actor, projectId, query.commit),
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
