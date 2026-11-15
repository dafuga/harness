import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import VideoGraphNavigation from '../../../src/components/verification-evidence/VideoGraphNavigation.svelte';
import EntityStates from '../../../src/components/explorer-ui/EntityStates.svelte';
import { evidence as entityEvidence } from '../../utils/entityScreenFixture';
import { record, revision } from '../../entityFixture';
import { commits, ids, units } from '../../entityUnits';
import { scope } from '../../entityPlaces';

test('VideoGraphNavigation.svelte is generated', () => {
	const library = {
		graphs: [],
		playlists: [
			{ id: 'search-match', clips: ['match'] },
			{ id: 'search-empty', clips: ['empty'] }
		],
		discoveryGaps: [{ unit: 'page.platforms', reason: 'Status filtering is awaiting inventory.' }]
	};
	const coverage = [
		{
			graph: 'platform-search',
			states: 1,
			edges: 0.5,
			clips: 0.5,
			complete: false,
			missing: ['mobile/edge/search-empty']
		}
	];
	const body = render(VideoGraphNavigation, {
		props: { library, coverage, selected: 'search-match' } as never
	}).body;
	for (const value of [
		'Video path',
		'Search match',
		'Search empty',
		'Declared graph coverage',
		'100%',
		'50%',
		'mobile/edge/search-empty',
		'Status filtering is awaiting inventory.'
	])
		expect(
			body,
			'modular branch controls show verified coverage and remaining discovery'
		).toContain(value);
	const empty = render(VideoGraphNavigation, { props: { library } as never }).body;
	expect(empty).toContain('No verified graph coverage');
	expect(empty).not.toContain('100%');
	const evidence = entityEvidence(
		units.find((unit) => unit.id === ids.page)!,
		revision(commits.tip, [record(commits.tip)])
	);
	evidence.scenarios[0].video = library as never;
	const result = evidence.after.record?.scenarios.find(
		(item) => item.id === evidence.scenarios[0].id
	);
	if (result) result.videoCoverage = coverage;
	const gallery = render(EntityStates, {
		props: { name: 'OrderList', evidence, scope: scope('current') } as never
	}).body;
	expect(gallery, 'state gallery must mount modular video paths and graph coverage').toContain(
		'Video paths and coverage'
	);
});
