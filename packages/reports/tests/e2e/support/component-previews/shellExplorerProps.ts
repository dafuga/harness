import type { PreviewCases } from './shared';
import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type {
	ExplorerEntity,
	ExplorerTab
} from '../../../../src/models/explorer-ui/Explorer.types';
import * as d from './explorerData';

/** Screen variants use the selected revision's ordinary explorer inputs. */
export function shellExplorerProps(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.harness-entity-sections') return sectionsProps(props, variant);
	if (id === 'reports.component.harness-explorer-controls')
		return {
			...props,
			filter: {
				...(props.filter as object),
				search: searchQuery(variant)
			}
		};
	if (id === 'reports.component.harness-explorer-index') {
		if (variant === 'empty') return { ...props, rows: [] };
		if (variant === 'layouts') return { ...props, category: 'layouts' };
		if (variant === 'configs') return { ...props, category: 'configs', rows: d.configRows };
		return props;
	}
	if (id === 'reports.component.harness-explorer-frame')
		return {
			...props,
			host: withoutRegistry(props.host as ExplorerScreenProps),
			registryRequired: variant !== 'registry-optional'
		};
	if (
		[
			'reports.component.harness-explorer-catalog-screen',
			'reports.component.harness-explorer-pages-screen'
		].includes(id)
	)
		return catalogProps(props, variant);
	if (id === 'reports.component.harness-explorer-content') return contentProps(variant);
	return null;
}

function withoutRegistry(host: ExplorerScreenProps): ExplorerScreenProps {
	return {
		...host,
		head: {
			...host.head,
			registry: {
				...host.head.registry,
				available: false,
				gap: 'The selected revision predates the unit registry'
			}
		}
	};
}

function contentProps(variant: string) {
	const host = d.host();
	if (['catalog', 'pages', 'configs', 'functions', 'platforms'].includes(variant)) {
		const category =
			variant === 'catalog' ? 'components' : (variant as ExplorerScreenProps['route']['category']);
		return { ...d.host(category), route: { ...host.route, category, entity: undefined } };
	}
	if (['styles', 'dependencies', 'translations', 'modules', 'permissions'].includes(variant))
		return { ...host, route: { ...host.route, entity: undefined, screen: variant } };
	return {
		...host,
		route: {
			...host.route,
			entity: variant === 'missing' ? 'missing.component' : host.route.entity,
			tab: variant === 'source' ? 'source' : undefined,
			section: variant === 'history' ? 'history' : 'details'
		}
	};
}

function sectionsProps(props: PreviewCases[string], variant: string) {
	let host = d.host();
	let entity = d.entity;
	if (variant === 'examples') {
		host = d.host('functions', 'examples');
		entity = d.entities.find((item) => item.category === 'functions')!;
	} else if (variant.startsWith('table')) {
		entity = {
			...entity,
			category: 'models',
			unit: {
				...entity.unit,
				kind: 'model',
				modelDefinitions:
					variant === 'table-empty'
						? []
						: [
								{
									name: 'Order',
									kind: 'class',
									fields: [],
									methods: [],
									source: 'src/models/orders/Order.ts',
									table: {
										name: 'orders',
										primaryKey: 'id',
										columns: [
											{
												name: 'id',
												property: 'id',
												type: 'TEXT',
												primaryKey: true,
												nullable: false,
												default: undefined
											}
										]
									}
								}
							]
			}
		} as ExplorerEntity;
		host = { ...host, route: { ...host.route, category: 'models', tab: 'table' } };
	} else if (variant === 'permissions') {
		entity = {
			...entity,
			category: 'apis',
			unit: { ...entity.unit, kind: 'api' }
		} as ExplorerEntity;
		host = { ...host, route: { ...host.route, category: 'apis', tab: 'permissions' } };
	} else host = { ...host, route: { ...host.route, tab: variant as ExplorerTab } };
	return { ...props, host, entity };
}

function searchQuery(variant: string) {
	if (variant === 'long') return 'Orders with a long source identifier and historical revision';
	return variant === 'search' ? 'Order' : '';
}

function catalogProps(props: PreviewCases[string], variant: string) {
	const host = props as unknown as ExplorerScreenProps;
	if (variant === 'empty') return { ...props, entities: [] };
	if (variant === 'unindexed') return withoutRegistry(host) as unknown as PreviewCases[string];
	if (['functions', 'configs', 'layouts'].includes(variant)) {
		const category = variant as ExplorerScreenProps['route']['category'];
		return { ...d.host(category), route: { ...host.route, category, entity: undefined } };
	}
	return props;
}
