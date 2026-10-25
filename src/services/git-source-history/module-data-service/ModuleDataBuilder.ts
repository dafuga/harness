import { reviewedModuleFacts } from './moduleReviews';
import { SourceIndexService } from '../../development-tooling/source-index-service/SourceIndexService';
import { ModuleDataCache } from './ModuleDataCache';
import type { ModuleData } from '../ModuleDataService.types';
import type { ModuleDataIdentity } from '../../../repositories/git-source-history/ModuleDataRepository.types';
import {
	moduleDataProducer,
	type ModuleDataRepository
} from '../../../repositories/git-source-history/ModuleDataRepository';
import type { ModuleDataValidatorResult } from '../../../validators/development-tooling/ModuleDataValidator.types';
import { RevisionDetailService } from '../../explorer-ui/revision-detail-service/RevisionDetailService';
import { HistoryStatusService } from '../../verification-evidence/history-status-service/HistoryStatusService';
import { ModuleDataValidator } from '../../../validators/development-tooling/ModuleDataValidator';
import { RegressionProofRepository } from '../../../repositories/RegressionProofRepository';
import { checkedMedia } from '../../../utils/mediaPlace';
import { moduleSourceFacts } from './moduleSourceFacts';
/** Reuse source facts; notes and attached evidence are independently checked at their pinned refs. */
export class ModuleDataBuilder {
	private indexer = new SourceIndexService();
	private builds = 0;
	private evidence?: { key: string; history: HistoryStatusService };
	constructor(private repository: ModuleDataRepository) {}
	async build(
		identity: ModuleDataIdentity,
		refreshSource = false,
		reviewed?: ModuleData
	): Promise<ModuleData> {
		this.boundCaches();
		const root = this.repository.root;
		const facts = await this.facts(identity, refreshSource, reviewed);
		const history = this.history(identity);
		const { records } = await new RevisionDetailService(root, history).recorded(
			identity.commit,
			checkedMedia
		);
		const regressions = await new RegressionProofRepository(root, identity.inputs.evidence).history(
			identity.commit,
			await history.all(),
			checkedMedia
		);
		const validation = new ModuleDataValidator().validate(
			{ commit: identity.commit, registry: facts.registry, records, regressions },
			identity.tree
		);
		addSourceIssues(validation, facts.sourceIssues);
		const body = {
			schemaVersion: 1 as const,
			producer: moduleDataProducer,
			...identity,
			...facts,
			...validation
		};
		return { ...body, digest: this.repository.digest(body) };
	}
	private async facts(identity: ModuleDataIdentity, refreshSource: boolean, reviewed?: ModuleData) {
		const root = this.repository.root;
		if (reviewed) return reviewedModuleFacts(root, reviewed);
		if (!refreshSource) {
			const prior =
				(await this.repository.source(identity))?.data ??
				(await new ModuleDataCache(this.repository).read(identity, true));
			if (prior) return sourceFields(prior);
		}
		return moduleSourceFacts(root, identity, this.indexer);
	}

	private boundCaches() {
		if (++this.builds % 32 === 0) {
			this.indexer = new SourceIndexService();
			this.evidence = undefined;
		}
	}
	private history(identity: ModuleDataIdentity) {
		const key = JSON.stringify(identity.inputs);
		if (this.evidence?.key !== key)
			this.evidence = {
				key,
				history: new HistoryStatusService(this.repository.root, identity.inputs)
			};
		return this.evidence.history;
	}
}
function addSourceIssues(validation: ModuleDataValidatorResult, errors: string[]) {
	for (const message of errors) {
		// Keep historical layout findings in sourceIssues; admission checks data completeness.
		// Current source layout remains enforced by units check and audit.
		if (message.endsWith('must be implemented under src/helpers/<responsibility>/')) continue;
		const unit = validation.modules.find(
			(item) => message.startsWith(`${item.id}:`) || message.startsWith(`${item.id} `)
		);
		if (unit)
			unit.issues.push({
				field: 'registry',
				message,
				repair: 'Correct the committed module manifest or source.'
			});
		else validation.issues.push(message);
	}
}

function sourceFields({
	reviews,
	declarations,
	registry,
	references,
	sourceGraph,
	versions,
	relationships,
	sourceIssues
}: ModuleData) {
	return {
		reviews,
		declarations,
		registry,
		references,
		sourceGraph,
		versions,
		relationships,
		sourceIssues
	};
}
