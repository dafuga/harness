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
	constructor(private repository: ModuleDataRepository) {}
	async build(identity: ModuleDataIdentity, refreshSource = false): Promise<ModuleData> {
		const root = this.repository.root,
			prior = refreshSource
				? undefined
				: ((await this.repository.source(identity)) ??
					(await new ModuleDataCache(this.repository).read(identity, true)));
		const facts = prior ? sourceFields(prior) : await moduleSourceFacts(root, identity);
		const history = new HistoryStatusService(root, identity.inputs);
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
}
function addSourceIssues(validation: ModuleDataValidatorResult, errors: string[]) {
	for (const message of errors) {
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
	declarations,
	registry,
	references,
	sourceGraph,
	versions,
	relationships,
	sourceIssues
}: ModuleData) {
	return { declarations, registry, references, sourceGraph, versions, relationships, sourceIssues };
}
