import { videoGraphNavigationProps } from './videoEvidenceProps';
import type { PreviewProps } from './shared.types';

export function videoGraphVariantProps(variant: string): PreviewProps {
	const base = structuredClone(videoGraphNavigationProps);
	const props: PreviewProps = { ...base, coverage: graphCoverage(variant), selected: '' };
	if (['empty-library', 'library-none', 'empty', 'none'].includes(variant))
		props.library = { graphs: [], playlists: [] };
	if (['library-one', 'one'].includes(variant))
		props.library = { graphs: [], playlists: base.library.playlists.slice(0, 1) };
	if (['library-many', 'many'].includes(variant))
		props.library = {
			...base.library,
			playlists: [...base.library.playlists, { id: 'reset-path', clips: ['reset'] }]
		};
	if (variant === 'graphs')
		props.library = {
			graphs: [
				{
					id: 'declared-search',
					unit: 'page.platforms',
					initial: 'ready',
					terminals: ['ready'],
					states: [{ id: 'ready', predicate: 'The page search is ready.' }],
					edges: [],
					clips: []
				}
			],
			playlists: []
		};
	if (variant === 'playlists') props.library = { graphs: [], playlists: base.library.playlists };
	if (variant === 'without-coverage') delete props.coverage;
	if (variant === 'without-selected') delete props.selected;
	if (variant === 'with-selected') props.selected = 'search-empty';
	return props;
}

function graphCoverage(variant: string) {
	const first = structuredClone(videoGraphNavigationProps.coverage[0]);
	if (
		['empty-library', 'library-none', 'empty', 'none', 'graphs', 'coverage-none'].includes(variant)
	)
		return [];
	if (variant === 'with-coverage')
		return [{ ...first, states: 1, edges: 1, clips: 1, complete: true, missing: [] }];
	if (variant === 'coverage-one') return [{ ...first, states: 0.25, edges: 0.5, clips: 0.75 }];
	if (['coverage-many', 'many'].includes(variant))
		return [
			first,
			{ ...first, graph: 'reset-path', complete: true, missing: [], states: 1, edges: 1, clips: 1 }
		];
	return [first];
}
