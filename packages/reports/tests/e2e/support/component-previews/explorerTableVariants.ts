import type { CatalogRow } from '../../../../src/utils/explorer-ui/entityCatalog';
import type { ConfigValueNode } from '../../../../../../src/utils/explorer-ui/unitMetadata';
import type { Kind } from '../../../../src/components/explorer-ui/ExplorerTable.types';
import { entityCatalog } from '../../../../src/utils/explorer-ui/entityCatalog';
import { entities, reading, shown } from './explorerData';
import { withApis } from '../../../../test/entityApiFixtures';
import { platformFixture } from '../../../../test/platformFixture';
import { explorerEntities } from '../../../../src/utils/explorerEntities';
import { explorerRelations } from '../../../../src/utils/explorerRelations';
import { routeIds, routeUnits } from './routeUnits';
import type { PreviewCases } from './shared';

/** Keep decoded strings separate from committed expressions and collection inspection. */
export function explorerTableVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'empty') return { ...props, rows: [] };
	const rows = props.rows as CatalogRow[];
	const literal = stringValue(variant);
	const source = expression(variant, literal);
	if (source === undefined)
		return {
			...props,
			category: variant,
			rows: categoryRows(variant as Kind)
		};
	const row = rows[0];
	const structure: ConfigValueNode =
		variant === 'value-open'
			? {
					kind: 'object',
					source,
					count: 2,
					entries: [
						{ name: 'active', node: { kind: 'expression', source: 'false' } },
						{ name: 'attempts', node: { kind: 'expression', source: '0' } }
					]
				}
			: { kind: 'expression', source };
	const name = `${row.configFile?.title ?? 'options'}.preview`;
	return {
		...props,
		rows: [
			{
				...row,
				id: `${row.id}-${variant}`,
				name,
				setting: {
					name,
					source: row.setting?.source ?? 'src/configs/orders/options.ts',
					value: source,
					literal,
					structure
				}
			}
		]
	};
}

/** Every category state supplies the kind of row it promises to demonstrate. */
function categoryRows(category: Kind): CatalogRow[] {
	if (category === 'platforms') return platformRows();
	if (!['apis', 'layouts', 'models', 'types'].includes(category))
		return entityCatalog(entities, category, reading.relations);
	const purposes: Record<string, string> = {
		[routeIds.shell]: 'Frames the order management pages.',
		[routeIds.model]: 'Stores an order and its delivery status.',
		[routeIds.types]: 'Describes an order submitted by a customer.'
	};
	const head = withApis({
		...shown.head,
		registry: {
			...shown.head.registry,
			units: [
				...shown.head.registry.units,
				...routeUnits.map((unit) => ({ ...unit, responsibility: purposes[unit.id] }))
			]
		}
	});
	return entityCatalog(explorerEntities(head), category, (id) => explorerRelations(head, id));
}

/** A configured platform is a catalog projection, never proof of a deployment. */
function platformRows(): CatalogRow[] {
	const platform = platformFixture.entries.find((entry) => entry.id === 'web')!;
	const seed = entities.find((entity) => entity.category === 'configs')!;
	const unit = {
		...seed.unit,
		id: platform.id,
		title: 'Website',
		responsibility: platform.summary,
		owns: { source: platform.sources, symbols: [] },
		dependencies: [],
		contract: { inputs: [], outputs: [], errors: [] },
		runtime: { kind: 'module', targets: [] }
	};
	const entity = {
		...seed,
		unit,
		id: platform.id,
		name: 'Website',
		category: 'platforms' as const,
		purpose: platform.summary,
		verdict: {
			passed: false,
			label: 'Not proven',
			reasons: ['No deployment verification is recorded.']
		}
	};
	return entityCatalog([entity], 'platforms', () => ({ pages: [], usedBy: [], components: [] }));
}
function stringValue(variant: string): string | undefined {
	if (variant === 'long-string') return 'Ready to ship after release review. '.repeat(20);
	if (variant === 'multiline-string') return 'Ready to ship.\nRelease reviewed.\nOrder confirmed.';
	return undefined;
}
function expression(variant: string, literal: string | undefined): string | undefined {
	if (literal !== undefined) return JSON.stringify(literal);
	if (variant === 'expression') return 'settings.region ?? "ca"';
	if (variant === 'long-expression') return '/' + 'ready_for_release_'.repeat(40) + '/i';
	if (variant === 'value-open') return '{ active: false, attempts: 0 }';
	return undefined;
}
