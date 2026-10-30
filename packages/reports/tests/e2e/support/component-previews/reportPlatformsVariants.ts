import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { PreviewCases } from './shared';

/** Platform listings use only this revision's catalog and selected route. */
export function platformsVariant(props: PreviewCases[string], variant: string) {
	const host = props as unknown as ExplorerScreenProps;
	if (variant === 'detail-web') return { ...props, route: { ...host.route, entity: 'web' } };
	if (variant === 'unindexed' || variant === 'status-not-recorded')
		return { ...props, head: { ...host.head, platforms: undefined } };
	if (variant === 'gap')
		return {
			...props,
			head: {
				...host.head,
				platforms: {
					...host.head.platforms!,
					gap: 'Deployment manifest is unavailable at this revision.'
				}
			}
		};
	return props;
}
