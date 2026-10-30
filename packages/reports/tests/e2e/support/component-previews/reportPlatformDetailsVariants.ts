import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { PreviewCases } from './shared';

/** A detail belongs to its selected platform and the same revision's declarations. */
export function platformDetailsVariant(props: PreviewCases[string], variant: string) {
	const host = props.host as ExplorerScreenProps;
	if (['ios', 'android', 'desktop', 'not-found'].includes(variant)) {
		const entity = variant === 'not-found' ? 'wearable' : variant;
		return { ...props, host: { ...host, route: { ...host.route, entity } } };
	}
	if (variant === 'source-unavailable')
		return { ...props, host: { ...host, index: { ...host.index, sourceRepository: undefined } } };
	if (variant === 'unindexed')
		return { ...props, host: { ...host, head: { ...host.head, platforms: undefined } } };
	if (variant === 'unrecorded')
		return { ...props, host: { ...host, head: { ...host.head, platforms: { entries: [] } } } };
	if (variant === 'gap')
		return {
			...props,
			host: {
				...host,
				head: {
					...host.head,
					platforms: { entries: [], gap: 'Deployment manifest is unavailable at this revision.' }
				}
			}
		};
	return null;
}
