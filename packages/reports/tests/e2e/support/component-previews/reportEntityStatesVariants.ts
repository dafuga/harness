import type {
	ExplorerEvidence,
	ExplorerScope
} from '../../../../src/models/explorer-ui/Explorer.types';
import type { Evidence } from '../../../../src/models/reports-media/Report.types';
import type { PreviewCases } from './shared';

/** Synthetic, visibly labelled fixture images show the matching populated or empty order list. */
export function orderListImage(empty: boolean, compact = false, mobile = false) {
	const firstRow = compact ? 155 : 230;
	const secondRow = compact ? 196 : 290;
	const left = mobile ? 24 : 52;
	const rowSize = mobile ? 16 : 24;
	const body = empty
		? `<text x="${left}" y="${firstRow}" fill="#d8e4ee" font-size="${rowSize}">No matching orders</text>`
		: `<text x="${left}" y="${firstRow}" fill="#d8e4ee" font-size="${rowSize}">Order A-1048 · Ready to ship</text><text x="${left}" y="${secondRow}" fill="#d8e4ee" font-size="${rowSize}">Order A-1047 · Delivered</text>`;
	const width = mobile ? 390 : 920;
	const height = mobile ? 844 : compact ? 230 : 560;
	const header = compact ? 40 : 60;
	const title = compact ? 95 : 125;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#0e1c29"/><g font-family="sans-serif"><text x="${left}" y="${header}" fill="#f3c33b" font-size="20">SYNTHETIC ORDER LIST</text><text x="${left}" y="${title}" fill="#f4f7fb" font-size="36">Orders</text>${body}</g></svg>`;
	return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** The fixture's image resolver represents the particular declared state, not a copied capture. */
export async function resolveStateImage(item: Evidence): Promise<string> {
	return orderListImage(item.title.startsWith('Empty'), false, item.viewport === 'mobile');
}

/** State gallery variations retain revision, scenario and missing-capture boundaries. */
export function entityStatesVariant(props: PreviewCases[string], variant: string) {
	const evidence = props.evidence as ExplorerEvidence;
	if (variant === 'scenario-open' || variant === 'scenario-selected')
		return { ...props, evidence: withArchivedScenario(evidence) };
	if (variant === 'image-error')
		return {
			...props,
			resolveImage: async (item: Evidence) =>
				item.title === 'Default · Before'
					? '/media/preview-invalid-image.svg'
					: resolveStateImage(item)
		};
	if (variant === 'viewer-open')
		return {
			...props,
			resolveImage: async (item: Evidence) => orderListImage(item.title.startsWith('Empty'), true)
		};
	if (variant === 'initial') {
		const scope = props.scope as ExplorerScope;
		return {
			...props,
			evidence: galleryEvidence(evidence, variant),
			scope: { ...scope, parent: null, summary: { ...scope.summary, parents: [] } }
		};
	}
	const changed = galleryEvidence(evidence, variant);
	if (changed) return { ...props, evidence: changed };
	if (variant === 'loading') return { ...props, resolveImage: () => new Promise<string>(() => {}) };
	if (variant === 'load-error')
		return {
			...props,
			resolveImage: async () => {
				throw new Error('Recorded capture could not be loaded.');
			}
		};
	if (['viewport-mobile', 'viewport-open', 'capture-details-open'].includes(variant)) return props;
	return null;
}

function withArchivedScenario(evidence: ExplorerEvidence): ExplorerEvidence {
	const first = evidence.scenarios[0];
	const archived = {
		...first,
		id: 'archived-orders',
		title: 'Archived orders',
		states: [{ id: 'archived', title: 'Archived', coverage: 'required' as const }]
	};
	return { ...evidence, scenarios: [first, archived] };
}

function galleryEvidence(evidence: ExplorerEvidence, variant: string): ExplorerEvidence | null {
	if (variant === 'empty') return { ...evidence, scenarios: [] };
	if (variant === 'current') return { ...evidence, mode: 'current', before: null };
	if (variant === 'initial')
		return {
			...evidence,
			before: null,
			initial: 'This is the first commit of its history: there is no parent to compare with.'
		};
	if (variant === 'coverage-gap') {
		const scenario = evidence.scenarios[0];
		const state = {
			id: 'pending',
			title: 'Pending',
			coverage: 'missing',
			reason: 'The team has not specified capture coverage.'
		};
		return { ...evidence, scenarios: [{ ...scenario, states: [state] }] };
	}
	if (variant === 'missing')
		return {
			...evidence,
			after: { ...evidence.after, captures: [] },
			before: evidence.before && { ...evidence.before, captures: [] }
		};
	if (variant === 'rejected')
		return {
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
		};
	if (variant === 'inapplicable') {
		const scenario = evidence.scenarios[0];
		return { ...evidence, scenarios: [{ ...scenario, states: [scenario.states[2]] }] };
	}
	if (variant === 'incomparable')
		return { ...evidence, incomparable: ['Viewport sizes changed between these revisions.'] };
	return null;
}
