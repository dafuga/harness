import type { ScenarioManifest } from '../../src/core/development-tooling/unitTypes';
import type { SourceTree } from '../../src/core/development-tooling/sourceTypes';

/** Shared finite declaration for schema, scoping and guide admission cases. */
export function videoEnrollment(
	unit: string,
	state: string,
	viewports: ScenarioManifest['viewports']
) {
	return {
		schemaVersion: 1 as const,
		viewports,
		clips: [
			{
				id: 'use-feature',
				unit,
				state,
				viewports: viewports.map(({ id }) => id),
				inputs: ['src/owner.ts'],
				script: { path: 'test/record.ts', export: 'record' },
				fixture: 'test/fixture.json',
				entry: 'ready',
				exit: 'done',
				states: ['ready', 'done'],
				edges: ['finish'],
				durationSeconds: 3
			}
		],
		graphs: [
			{
				id: 'feature',
				unit,
				initial: 'ready',
				terminals: ['done'],
				states: [
					{ id: 'ready', predicate: 'Ready visible' },
					{ id: 'done', predicate: 'Done visible' }
				],
				edges: [{ id: 'finish', from: 'ready', to: 'done', action: 'Finish' }],
				clips: ['use-feature']
			}
		],
		playlists: [{ id: 'feature', clips: ['use-feature'] }]
	};
}

/** A source tree whose top-level script would throw if validation imported it. */
export function videoEnrollmentTree(
	scenario: ScenarioManifest,
	changes: Record<string, string> = {}
): SourceTree {
	const paths = new Map(
		Object.entries({
			[`specification/scenarios/${scenario.id}.json`]: JSON.stringify(scenario),
			[`specification/units/${scenario.units[0]}.json`]: JSON.stringify({
				id: scenario.units[0],
				status: 'active',
				kind: 'page',
				owns: { source: ['src/owner.ts'] }
			}),
			'src/owner.ts': 'export const owner = true;',
			'test/record.ts': "throw new Error('never import'); export async function record() {}",
			'test/fixture.json': '{}',
			...changes
		})
	);
	return {
		revision: 'enrollment-fixture',
		list: async () => [...paths.keys()].map((path) => ({ path, hash: path })),
		read: async (path) => {
			if (!paths.has(path)) throw new Error(`Missing ${path}`);
			return paths.get(path)!;
		}
	};
}

/** Two independent owners for the existing scoped scenario matrix. */
export function twoOwnerVideo(
	firstUnit: string,
	firstState: string,
	secondUnit: string,
	secondState: string
) {
	const first = videoEnrollment(firstUnit, firstState, [{ id: 'desktop', width: 1, height: 1 }]);
	const second = videoEnrollment(secondUnit, secondState, first.viewports);
	second.clips[0].id = 'other-feature';
	second.graphs[0].id = 'other-graph';
	second.graphs[0].clips = ['other-feature'];
	return {
		...first,
		clips: [...first.clips, ...second.clips],
		graphs: [...first.graphs, ...second.graphs],
		playlists: [{ id: 'all', clips: ['use-feature', 'other-feature'] }]
	};
}
