import type { ExplorerPermissionsScreenProps } from '../../../../src/components/networking-security/ExplorerPermissionsScreen.types';
import type { PreviewCases } from './shared';

/** A permission view uses only the selected revision's fictional profile declarations. */
export function permissionsVariant(props: PreviewCases[string], variant: string) {
	const host = props as unknown as ExplorerPermissionsScreenProps;
	const catalog = host.head.permissions!;
	if (
		variant.startsWith('index') ||
		variant === 'guest' ||
		variant === 'admin' ||
		variant === 'not-found'
	) {
		const entity = variant.startsWith('index')
			? undefined
			: variant === 'not-found'
				? 'unknown'
				: variant;
		return { ...props, route: { ...host.route, entity } };
	}
	if (variant === 'empty' || variant === 'unindexed')
		return {
			...props,
			route: { ...host.route, entity: undefined },
			head: {
				...host.head,
				permissions: variant === 'empty' ? { ...catalog, profiles: [] } : undefined
			}
		};
	if (variant === 'gap')
		return {
			...props,
			head: {
				...host.head,
				permissions: { ...catalog, gaps: ['Policy manifest is unavailable at this revision.'] }
			}
		};
	if (variant === 'empty-data')
		return {
			...props,
			head: {
				...host.head,
				permissions: {
					...catalog,
					profiles: catalog.profiles.map((profile) =>
						profile.id === 'member'
							? {
									...profile,
									grants: profile.grants.map((grant) =>
										grant.kind === 'api' ? { ...grant, data: [] } : grant
									)
								}
							: profile
					)
				}
			}
		};
	if (variant.startsWith('endpoint'))
		return {
			...props,
			endpoint: variant === 'endpoint-empty' ? 'app.endpoint.other' : 'app.endpoint.orders',
			head: { ...host.head, permissions: variant === 'endpoint-unindexed' ? undefined : catalog }
		};
	return null;
}
