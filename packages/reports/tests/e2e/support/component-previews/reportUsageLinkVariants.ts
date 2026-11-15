import type { ExplorerEvidence } from '../../../../src/models/explorer-ui/Explorer.types';
import type { EntityLens, EntityNav } from '../../../../src/utils/explorer-ui/entityLens';
import type { PreviewCases } from './shared';
import { commits, entities, entity, ids } from './explorerData';
import { orderListImage } from './reportEntityStatesVariants';

/** The link's preview belongs to the same fictional consumer and its selected revision. */
export function usageLinkVariant(
	props: PreviewCases[string],
	variant: string
): PreviewCases[string] | null {
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
	if (
		!['visual-open', 'hover-open', 'inherited-open', 'missing-open', 'image-error-open'].includes(
			variant
		)
	)
		return null;
	const lens = props.lens as EntityLens;
	const evidence = lens.evidence(entity.unit);
	let after: ExplorerEvidence['after'] = {
		...evidence.after,
		captures:
			variant === 'missing-open'
				? []
				: evidence.after.captures.map((found) => ({
						...found,
						capture: {
							...found.capture,
							media:
								variant === 'image-error-open'
									? '/media/preview-invalid-image.svg'
									: orderListImage(false)
						}
					}))
	};
	if (variant === 'inherited-open') after = inheritedSide(after);
	return { ...props, mediaBase: '', lens: { ...lens, evidence: () => ({ ...evidence, after }) } };
}

/** A passed capture inherited from the previous fictional revision retains its true origin. */
function inheritedSide(after: ExplorerEvidence['after']): ExplorerEvidence['after'] {
	const record = after.record!;
	return {
		...after,
		detail: null,
		record: {
			...record,
			scenarios: record.scenarios.map((scenario) => ({
				...scenario,
				inherited: true,
				testedRevision: commits.first,
				origin: { record: 'rec-aaaaaa-0000', commit: commits.first }
			}))
		},
		captures: after.captures.map((found) => ({
			...found,
			current: false,
			inheritedFrom: commits.first,
			capture: {
				...found.capture,
				server: found.capture.server && { ...found.capture.server, revision: commits.first }
			}
		}))
	};
}
