import { ModuleDataSnapshotValidator } from '../../../../../src/validators/development-tooling/ModuleDataSnapshotValidator';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../../../src/utils/development-tooling/canonicalJson';
import { formatModuleDataFailure } from '../../../../../src/helpers/git-source-history/formatModuleDataFailure';
import type { ModuleData } from '../../../../../src/services/git-source-history/ModuleDataService.types';
import type { HubSourceContext } from './hubSource';
import { hubFail } from './hubJson';
import {
	moduleDataProducer as producer,
	moduleDataRef
} from '../../../../../src/services/git-source-history/module-data-service/moduleDataProtocol';
export async function hubModuleData(context: HubSourceContext, admit = false): Promise<ModuleData> {
	const tip = await context.source.optionalRef(context.repository, moduleDataRef);
	if (!tip)
		throw new Error('Missing committed module data; run harness validate --write --sync origin.');
	const identity = {
		producer,
		commit: context.commit,
		tree: context.identity.sourceTree,
		inputs: { notes: context.identity.notesRevision, evidence: context.identity.evidenceRevision }
	};
	const hash = (data: unknown) => createHash('sha256').update(canonicalJson(data)).digest('hex');
	const bytes = await context.source.read(context.repository, {
		commit: tip.commit,
		path: `modules/${context.commit}/${hash(identity)}.json`
	});
	const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as ModuleData;
	const { digest, ...body } = data;
	if (
		data.schemaVersion !== 1 ||
		!new ModuleDataSnapshotValidator().validate(data).valid ||
		data.producer !== producer ||
		hash(body) !== digest ||
		hash({ producer: data.producer, commit: data.commit, tree: data.tree, inputs: data.inputs }) !==
			hash(identity)
	)
		return hubFail();
	const failure = admit ? formatModuleDataFailure(data) : undefined;
	if (failure) throw new Error(failure);
	return data;
}
export function hubRequiresModuleData(context: HubSourceContext) {
	return context.entries.some((entry) => entry.path === 'harness.validation.json');
}
