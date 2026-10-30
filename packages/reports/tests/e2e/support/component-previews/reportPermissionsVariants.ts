import type { ExplorerPermissionsScreenProps } from '../../../../src/components/networking-security/ExplorerPermissionsScreen.types';
import type { PreviewCases } from './shared';

/** A permission view uses only the selected revision's fictional profile declarations. */
export function permissionsVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'data-focused') return props;
	const host = props as unknown as ExplorerPermissionsScreenProps;
	const catalog = host.head.permissions!;
	if (variant.startsWith('index')) return { ...props, route: { ...host.route, entity: undefined } };
	if (['guest', 'admin', 'not-found'].includes(variant)) {
		const entity = variant === 'not-found' ? 'unknown' : variant;
		return { ...props, route: { ...host.route, entity } };
	}
	if (['empty', 'unindexed'].includes(variant)) return emptyCatalog(host, variant);
	if (variant === 'gap')
		return {
			...props,
			head: {
				...host.head,
				permissions: { ...catalog, gaps: ['Policy manifest is unavailable at this revision.'] }
			}
		};
	if (variant === 'empty-data') return withoutApiData(host);
	if (variant.startsWith('endpoint')) return endpointCatalog(host, variant);
	return null;
}

function emptyCatalog(host: ExplorerPermissionsScreenProps, variant: string) {
	return {
		...host,
		route: { ...host.route, entity: undefined },
		head: {
			...host.head,
			permissions: variant === 'empty' ? { ...host.head.permissions!, profiles: [] } : undefined
		}
	};
}

function endpointCatalog(host: ExplorerPermissionsScreenProps, variant: string) {
	return {
		...host,
		endpoint: variant === 'endpoint-empty' ? 'app.endpoint.other' : 'app.endpoint.orders',
		head: {
			...host.head,
			permissions: variant === 'endpoint-unindexed' ? undefined : host.head.permissions
		}
	};
}

function withoutApiData(host: ExplorerPermissionsScreenProps) {
	const catalog = host.head.permissions!;
	return {
		...host,
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
}
