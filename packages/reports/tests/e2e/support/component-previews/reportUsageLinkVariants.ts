import type { ExplorerEvidence } from '../../../../src/models/explorer-ui/Explorer.types';
import type { EntityLens, EntityNav } from '../../../../src/utils/entityLens';
import type { PreviewCases } from './shared';
import { entities, entity, ids } from './explorerData';
import { orderListImage } from './reportEntityStatesVariants';

/** The link's preview belongs to the same fictional consumer and its selected revision. */
export function usageLinkVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'function-open')
		return { ...props, entity: entities.find((item) => item.id === ids.filter) };
	if (variant.startsWith('source-')) {
		const nav = props.nav as EntityNav;
		return {
			...props,
			entity: {
				...entity,
				name: 'renderOrderRow',
				caller: { symbol: 'renderOrderRow', sourceOnly: true }
			},
			nav: variant === 'source-enabled' ? { ...nav, source: () => {} } : nav
		};
	}
	if (variant === 'touch') return props;
	if (variant !== 'visual-open' && variant !== 'missing-open') return null;
	const lens = props.lens as EntityLens;
	const evidence = lens.evidence(entity.unit);
	const after: ExplorerEvidence['after'] = {
		...evidence.after,
		captures:
			variant === 'missing-open'
				? []
				: evidence.after.captures.map((found) => ({
						...found,
						capture: { ...found.capture, media: orderListImage(false) }
					}))
	};
	return { ...props, mediaBase: '', lens: { ...lens, evidence: () => ({ ...evidence, after }) } };
}
