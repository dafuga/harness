import type { CatalogRow } from '../../../../src/utils/explorer-ui/entityCatalog';
import type { ConfigValueNode } from '../../../../../../src/utils/explorer-ui/unitMetadata';
import type { Kind } from '../../../../src/components/explorer-ui/ExplorerTable.types';
import { entityCatalog } from '../../../../src/utils/explorer-ui/entityCatalog';
import { entities, reading } from './explorerData';
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
			rows: entityCatalog(entities, variant as Kind, reading.relations)
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
