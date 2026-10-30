import type { ExplorerEvidence } from '../../../../src/models/explorer-ui/Explorer.types';
import type { Evidence } from '../../../../src/models/reports-media/Report.types';
import type { PreviewCases } from './shared';

/** Synthetic, visibly labelled fixture images show the matching populated or empty order list. */
function orderListImage(empty: boolean) {
	const body = empty
		? '<text x="52" y="230" fill="#d8e4ee" font-size="24">No matching orders</text>'
		: '<text x="52" y="230" fill="#d8e4ee" font-size="24">Order A-1048 · Ready to ship</text><text x="52" y="290" fill="#d8e4ee" font-size="24">Order A-1047 · Delivered</text>';
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560" viewBox="0 0 920 560"><rect width="920" height="560" fill="#0e1c29"/><g font-family="sans-serif"><text x="52" y="60" fill="#f3c33b" font-size="20">SYNTHETIC ORDER LIST</text><text x="52" y="125" fill="#f4f7fb" font-size="36">Orders</text>${body}</g></svg>`;
	return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** The fixture's image resolver represents the particular declared state, not a copied capture. */
export async function resolveStateImage(item: Evidence): Promise<string> {
	return orderListImage(item.title.startsWith('Empty'));
}

/** State gallery variations retain revision, scenario and missing-capture boundaries. */
export function entityStatesVariant(props: PreviewCases[string], variant: string) {
	const evidence = props.evidence as ExplorerEvidence;
	if (variant === 'empty') return { ...props, evidence: { ...evidence, scenarios: [] } };
	if (variant === 'current')
		return { ...props, evidence: { ...evidence, mode: 'current', before: null } };
	if (variant === 'missing')
		return {
			...props,
			evidence: {
				...evidence,
				after: { ...evidence.after, captures: [] },
				before: evidence.before && { ...evidence.before, captures: [] }
			}
		};
	if (variant === 'rejected')
		return {
			...props,
			evidence: {
				...evidence,
				mode: 'current',
				before: null,
				after: {
					...evidence.after,
					captures: evidence.after.captures.map((capture) => ({
						...capture,
						usable: false,
						standing: 'rejected'
					}))
				}
			}
		};
	if (variant === 'inapplicable') {
		const scenario = evidence.scenarios[0];
		return {
			...props,
			evidence: { ...evidence, scenarios: [{ ...scenario, states: [scenario.states[2]] }] }
		};
	}
	if (variant === 'incomparable')
		return {
			...props,
			evidence: { ...evidence, incomparable: ['Viewport sizes changed between these revisions.'] }
		};
	if (variant === 'loading') return { ...props, resolveImage: () => new Promise<string>(() => {}) };
	if (variant === 'load-error')
		return {
			...props,
			resolveImage: async () => {
				throw new Error('Recorded capture could not be loaded.');
			}
		};
	if (variant === 'viewport-mobile' || variant === 'viewer-open') return props;
	return null;
}
