import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { PreviewCases } from './shared';

/** Module and resource screens retain their generated, missing and unavailable presentations. */
export const moduleCatalogVariants: Record<string, string[]> = {
	'reports.component.module-system-explorer-module-resources-screen': [
		'playwright',
		'empty-generated',
		'unavailable',
		'not-found',
		'unindexed',
		'missing-id'
	]
};

/** Select only module data recorded at the synthetic revision. */
export function moduleVariant(id: string, props: PreviewCases[string], variant: string) {
	if (!id.endsWith('explorer-module-resources-screen') || variant === 'playwright') return null;
	const host = props as unknown as ExplorerScreenProps;
	if (variant === 'unindexed') return changed(host, { modules: undefined }, host.route.entity);
	if (variant === 'missing-id') return changed(host, {}, undefined);
	if (variant === 'not-found') return changed(host, {}, 'unknown.resource');
	if (variant === 'unavailable') return changed(host, {}, 'offline.collection');
	const modules = host.head.modules!;
	if (variant === 'empty-generated')
		return changed(
			host,
			{
				modules: {
					...modules,
					modules: modules.modules.map((entry) =>
						entry.definition.id === 'email' ? { ...entry, instances: [] } : entry
					)
				}
			},
			'email.email'
		);
	return null;
}

function changed(
	host: ExplorerScreenProps,
	head: Partial<ExplorerScreenProps['head']>,
	entity?: string
) {
	const route = { ...host.route, entity };
	return {
		...host,
		head: { ...host.head, ...head },
		route,
		scope: { ...host.scope, location: route }
	};
}
