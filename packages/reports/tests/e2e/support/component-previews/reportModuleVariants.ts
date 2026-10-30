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
	],
	'reports.component.module-system-explorer-modules-screen': [
		'playwright',
		'headless-audio',
		'detail-email',
		'detail-offline',
		'project-module',
		'unindexed',
		'empty',
		'gaps',
		'not-found',
		'detail-unindexed',
		'link-focused',
		'link-hovered'
	]
};

/** Select only module data recorded at the synthetic revision. */
export function moduleVariant(id: string, props: PreviewCases[string], variant: string) {
	if (variant === 'playwright' || variant === 'headless-audio') return null;
	const host = props as unknown as ExplorerScreenProps;
	if (!id.endsWith('explorer-module-resources-screen')) return moduleListVariant(host, variant);
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

function moduleListVariant(host: ExplorerScreenProps, variant: string) {
	if (variant === 'unindexed' || variant === 'detail-unindexed')
		return changed(
			host,
			{ modules: undefined },
			variant === 'detail-unindexed' ? 'email' : undefined
		);
	if (variant === 'not-found') return changed(host, {}, 'unknown');
	if (variant === 'detail-email' || variant === 'detail-offline')
		return changed(host, {}, variant.slice('detail-'.length));
	const modules = host.head.modules!;
	if (variant === 'empty')
		return changed(host, { modules: { ...modules, modules: [] } }, undefined);
	if (variant === 'gaps')
		return changed(
			host,
			{
				modules: { ...modules, gaps: ['One module declaration is unavailable at this revision.'] }
			},
			undefined
		);
	if (variant === 'project-module')
		return changed(
			host,
			{
				modules: {
					...modules,
					modules: modules.modules.map((entry) =>
						entry.definition.id === 'email' ? { ...entry, source: 'project' as const } : entry
					)
				}
			},
			'email'
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
