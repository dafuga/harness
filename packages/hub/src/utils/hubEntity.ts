import type { CommittedThread } from 'collaboration';
import type { EntityDetail } from '../../../desktop/src/models/Desktop.types';
import { hubRead, type HubSourceContext } from './hubSource';
import { readUnitDocumentation } from '../../../../src/utils/unitDocumentation';
import { hubCatalog, hubRelationships, hubOwnedPaths } from './hubCatalog';
import { hubFail } from './hubJson';
import { hubThreads } from './hubThreads';
import { hubHistory } from './hubHistory';
import { hubArtifactCommit } from './hubArtifactCommit';
import { hubSize } from './hubSize';
import { hubEntityContract } from './hubEntityContract';
export async function hubEntity(
	context: HubSourceContext,
	query: { entityId: string; commit: string; branch: string; shared: CommittedThread[] }
): Promise<EntityDetail> {
	const data = await hubCatalog(context);
	const item = data.items.find((i) => i.id === query.entityId),
		unit = data.units.find((u) => u.id === query.entityId),
		plan = data.records.find((p) => p.id === query.entityId);
	if (!item) return hubFail('not-found');
	const sources = unit ? hubOwnedPaths(context, unit) : [];
	const contract = await hubEntityContract(unit, plan);
	const history = await hubHistory(context, {
		branch: query.branch,
		paths: [
			...(unit?.owns.source ?? []),
			...(unit?.documentation ? [unit.documentation] : []),
			...(plan ? [plan.path] : [])
		]
	});
	return {
		...item,
		threadCount: query.shared.length,
		contract,
		documentation: unit
			? await readUnitDocumentation(
					{
						read: async (path) => new TextDecoder().decode(await hubRead(context, path))
					},
					unit
				)
			: undefined,
		sources,
		size: hubSize(context, sources),
		performance: { available: false, text: 'Not measured' },
		relationships: unit ? hubRelationships(unit, data.units, data.items) : [],
		versions: await Promise.all(
			(plan?.versions ?? []).map(async (version) => ({
				...version,
				commit: await hubArtifactCommit(
					context,
					`${plan?.path}/designs/${version.version}/design.json`
				)
			}))
		),
		threads: hubThreads(query.shared),
		historyCoverage: { complete: history.complete, nextPage: history.nextPage, loadedPages: 1 },
		history: history.entries
	};
}
