import type { DetailContext, DetailData } from './catalogDetail.types';
import type { ComponentManifest } from '../../../../../../../src/lib/contracts';
import type {
	CatalogEntity,
	EntityDetail,
	Relationship
} from '../../../../models/development-tooling/Desktop.types';
import type { GitSourceAdapter } from '../git-source-adapter/GitSourceAdapter';
import { catalogHistory } from './catalogHistory';
import { categoryOf } from '../../../../utils/development-tooling/categoryOf';

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
	const apis = unit.kind === 'page' ? pageApis(unit, units) : new Set<string>();
	return units.flatMap((candidate) => {
		if (candidate.id === unit.id) return [];
		let direction: Relationship['direction'];
		if (candidate.dependencies.some((d) => d.unit === unit.id)) direction = 'used-by';
		else if (unit.dependencies.some((d) => d.unit === candidate.id) || apis.has(candidate.id))
			direction = 'uses';
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

/** Follow page dependencies at this revision; no runtime-only requests are inferred. */
function pageApis(page: ComponentManifest, units: ComponentManifest[]): Set<string> {
	const found = new Set<string>();
	const byId = new Map(units.map((unit) => [unit.id, unit]));
	const layouts = units.filter(
		(unit) =>
			unit.kind === 'layout' &&
			unit.owns.source.some(
				(source) =>
					source.endsWith('/+layout.svelte') &&
					page.owns.source.some((path) => path.startsWith(source.slice(0, -14)))
			)
	);
	const queue = [page.id, ...layouts.map((unit) => unit.id)];
	const seen = new Set<string>();
	for (const id of queue) {
		if (seen.has(id)) continue;
		seen.add(id);
		const unit = byId.get(id);
		if (!unit) continue;
		if (categoryOf(unit.kind) === 'apis') found.add(id);
		queue.push(...unit.dependencies.map((dependency) => dependency.unit));
	}
	return found;
}
