import type { ComponentManifest } from '../../../../../src/lib/contracts';
import type { CatalogEntity, EntityDetail, Relationship } from '../../models/Desktop.types';
import type { PlanningPort, PlanRecord } from '../../models/PlanningPort.types';
import type { GitSourceAdapter } from '../../adapters/git-source-adapter/GitSourceAdapter';
import { catalogHistory } from './catalogHistory';
import { categoryOf } from '../../utils/categoryOf';

interface DetailContext {
	source: GitSourceAdapter;
	planning: PlanningPort;
}

interface DetailData {
	id: string;
	revision: string;
	items: CatalogEntity[];
	units: ComponentManifest[];
	plan: PlanRecord | undefined;
}

export async function catalogDetail(
	context: DetailContext,
	data: DetailData
): Promise<EntityDetail> {
	const { id, revision, items, units, plan } = data,
		{ source } = context;
	const item = items.find((i) => i.id === id),
		unit = units.find((u) => u.id === id);
	if (!item) throw new Error('Entity not found at this revision.');
	const history = await entityHistory(context, { id, revision, unit, hasPlan: Boolean(plan) });
	const contract = plan?.contract ?? unitContract(source, unit);
	return {
		...item,
		contract,
		documentation: await source.documentation(unit, revision),
		relationships: unit ? relationships({ units, items, unit }) : [],
		versions: plan?.versions ?? [],
		threads: plan?.threads ?? [],
		history: [...new Map(history.map((h) => [h.id, h])).values()].sort((a, b) =>
			b.at.localeCompare(a.at)
		),
		...(await sourceDetails(source, unit, revision)),
		performance: { available: false, text: 'Not measured' }
	};
}

async function entityHistory(
	context: DetailContext,
	query: {
		id: string;
		revision: string;
		unit: ComponentManifest | undefined;
		hasPlan: boolean;
	}
) {
	return [
		...(query.hasPlan ? await context.planning.history(query.id, query.revision) : []),
		...(query.unit ? await catalogHistory(context.source.root, query.revision, query.unit) : [])
	];
}

async function sourceDetails(
	source: GitSourceAdapter,
	unit: ComponentManifest | undefined,
	revision: string
) {
	if (!unit) return { sources: [], size: { available: false, text: 'Not measured: design only' } };
	return { sources: await source.sources(unit, revision), size: await source.size(unit, revision) };
}

function unitContract(source: GitSourceAdapter, unit: ComponentManifest | undefined) {
	if (!unit) return { inputs: [], outputs: [], errors: [], hash: null };
	return { ...unit.contract, hash: source.contractHash(unit) };
}

function relationships(data: {
	units: ComponentManifest[];
	items: CatalogEntity[];
	unit: ComponentManifest;
}): Relationship[] {
	const { units, items, unit } = data;
	return units.flatMap((candidate) => {
		if (candidate.id === unit.id) return [];
		let direction: Relationship['direction'];
		if (candidate.dependencies.some((d) => d.unit === unit.id)) direction = 'used-by';
		else if (unit.dependencies.some((d) => d.unit === candidate.id)) direction = 'uses';
		else return [];
		const related = items.find((i) => i.id === candidate.id);
		return [
			{
				id: candidate.id,
				title: candidate.title,
				category: categoryOf(candidate.kind),
				direction,
				hasPlan: Boolean(related?.hasPlan),
				verification: related?.verification ?? 'unknown'
			}
		];
	});
}
