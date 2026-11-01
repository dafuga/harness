import { shellImage } from './shellArtworkImages';
import { desktopData } from './sealedData';
import type {
	ExplorerEvidence,
	ExplorerSide
} from '../../../../src/models/explorer-ui/Explorer.types';
import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import { explorerEntities } from '../../../../src/utils/explorerEntities';
import {
	ids,
	commits,
	index,
	entities as ordersEntities,
	evidence as ordersEvidence
} from './explorerData';
import { routeIds, routeUnits } from './routeUnits';
import { text, type PreviewCases } from './shared';
import { explorerSearchEntries } from '../../../../src/utils/explorer-ui/explorerSearchEntries';

/** Each side keeps its identity and declared viewport, with distinct before/after content. */
export function shellEvidence(
	evidence: ExplorerEvidence,
	id: string,
	incomparable = false,
	inline = true
): ExplorerEvidence {
	const side = (original: ExplorerSide, before: boolean): ExplorerSide => ({
		...original,
		captures: original.captures.map((found) => ({
			...found,
			capture:
				found.capture.kind !== 'screenshot' || found.capture.media === null
					? found.capture
					: {
							...found.capture,
							media: inline
								? shellImage(id, found.capture.viewport, before, before && incomparable)
								: `media/sol8-shell-${encodeURIComponent(id)}-${found.capture.viewport}-${before ? 'before' : 'after'}.svg`,
							mediaType: 'image/svg+xml'
						}
		}))
	});
	return {
		...evidence,
		before: evidence.before && side(evidence.before, true),
		after: side(evidence.after, false)
	};
}

/** Review examples use a scenario name without changing recorded bytes or capture provenance. */
export function reviewedOrdersEvidence(evidence: ExplorerEvidence): ExplorerEvidence {
	const name = (title: string) =>
		title.replaceAll(
			'Orders page over synthetic orders',
			'Browse customer orders and delivery status'
		);
	const side = (original: ExplorerSide): ExplorerSide => ({
		...original,
		coverage: original.coverage.map((scenario) => ({
			...scenario,
			title: name(scenario.title),
			reasons: scenario.reasons.map(name),
			states: scenario.states.map((state) => ({ ...state, reasons: state.reasons.map(name) }))
		}))
	});
	return {
		...evidence,
		scenarios: evidence.scenarios.map((scenario) => ({ ...scenario, title: name(scenario.title) })),
		before: evidence.before && side(evidence.before),
		after: side(evidence.after)
	};
}

/** Limit artwork substitutions to the shell owners under review, including their nested cards. */
export function shellArtworkHost(host: ExplorerScreenProps): ExplorerScreenProps {
	return {
		...host,
		lens: {
			...host.lens,
			evidence: (unit) =>
				shellEvidence(
					unit.id === routeIds.shell ? ordersEvidence : host.lens.evidence(unit),
					unit.id,
					false,
					false
				)
		}
	};
}

export function shellArtworkProps(id: string, props: PreviewCases[string], variant: string) {
	if (id.endsWith('harness-harness-navbar')) return navbarPreviewProps(props, variant);
	if (id === 'reports.component.harness-entity-tests') return entityTestsProps(props);
	if (id.endsWith('harness-entity-screens'))
		return {
			...props,
			evidence: shellEvidence(
				props.evidence as ExplorerEvidence,
				ids.list,
				variant === 'incomparable'
			),
			mediaBase: ''
		};
	if (id.endsWith('harness-entity-sections'))
		return {
			...props,
			host: ['states', 'tests'].includes(variant)
				? props.host
				: shellArtworkHost(props.host as ExplorerScreenProps),
			pane: text('<div></div>')
		};
	if (
		![
			'reports.component.harness-explorer-catalog-screen',
			'reports.component.harness-explorer-content'
		].includes(id)
	)
		return props;
	let host = props as unknown as ExplorerScreenProps;
	if (variant === 'layouts') {
		const layout = routeUnits.find((unit) => unit.id === routeIds.shell)!;
		const head = {
			...host.head,
			registry: { ...host.head.registry, units: [...host.head.registry.units, layout] }
		};
		host = { ...host, head, entities: explorerEntities(head) };
	}
	if (variant === 'search')
		host = {
			...host,
			entities: host.entities.map((item) =>
				item.id === ids.search
					? {
							...item,
							purpose: 'Finds records by text query.',
							unit: { ...item.unit, responsibility: 'Finds records by text query.' }
						}
					: item
			)
		};
	return shellArtworkHost(host) as unknown as PreviewCases[string];
}

function entityTestsProps(props: PreviewCases[string]) {
	const data = desktopData.results[`${ids.list}|commit|${commits.middle}`];
	return {
		...props,
		evidence: shellEvidence(reviewedOrdersEvidence(data.evidence), ids.list),
		behavior: data.behavior,
		mediaBase: ''
	};
}

function navbarPreviewProps(props: PreviewCases[string], variant: string) {
	const shown = variant === 'unresolved' ? props : navbarProps(props, variant);
	const scope = shown.scope as ExplorerScreenProps['scope'] | null;
	return {
		...shown,
		repository: ['no-repository', 'long-repository'].includes(variant)
			? props.repository
			: 'Northstar Store',
		search: { entries: explorerSearchEntries(ordersEntities, scope?.commit ?? commits.tip) }
	};
}

function navbarProps(props: PreviewCases[string], variant: string) {
	const scope = props.scope as ExplorerScreenProps['scope'];
	if (variant === 'historical')
		return { ...props, scope: { ...scope, mode: 'commit', commit: commits.first, atTip: false } };
	return {
		...props,
		scope: {
			...scope,
			mode: 'current',
			commit: commits.tip,
			summary: index.revisions[0],
			atTip: true,
			location: {
				...scope.location,
				category: variant === 'pages' ? 'pages' : 'components',
				commit: null
			}
		}
	};
}
