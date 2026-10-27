import type { PlannedFile } from '../../../core/development-tooling/files';
import type {
	ComponentManifest,
	ScenarioManifest
} from '../../../core/development-tooling/unitTypes';
import { toKebabCase } from '../../../helpers/strings/case';
import { unitIdentity } from '../../../utils/accounts-access/classify-path/unitIdentity';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { appVisualViewports } from './appContractTests';

/** Register generated page and layout state screenshots under their source-derived identity. */
export function pageContractFiles(
	name: string,
	source: string,
	workspace: string,
	location: { root: string; build: string } = { root: '.', build: 'app' }
): PlannedFile[] {
	const identity = unitIdentity(source, workspace);
	if (identity?.kind !== 'page' && identity?.kind !== 'layout')
		throw new Error(`Invalid page or layout source: ${source}`);
	const kind = identity.kind;
	const route = toKebabCase(name);
	const title = `/${route}`;
	const scenario = identity.id.replace('.', '-');
	const states = kind === 'page' ? ['default', 'error-state'] : ['default'];
	const prefix = `${location.root}/`.replace(/^\.\//, '');
	const entry = `${prefix}${source}`;
	const cases = pageCases(route, kind, states, prefix);
	const unit: ComponentManifest = {
		schemaVersion: 1,
		id: identity.id,
		kind,
		title,
		responsibility: `Owns the ${title} route ${kind === 'page' ? 'page' : 'layout'}.`,
		responsibilityOrigin: 'derived',
		status: 'active',
		owns: { source: [entry], symbols: [kind === 'page' ? '+page' : '+layout'] },
		contract: { origin: 'derived', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: { kind: 'module', entry, targets: [{ kind: 'module', entry }] },
		scenarios: [scenario],
		testing: {
			version: 1,
			shape: 'page',
			states,
			props: [kind === 'page' ? 'error' : 'children'],
			cases
		},
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
	return [
		{ path: `specification/units/${identity.id}.json`, contents: stableJson(unit) },
		{
			path: `specification/scenarios/${scenario}.json`,
			contents: stableJson(pageScenario(unit, route, location))
		}
	];
}

function pageCases(
	route: string,
	kind: 'page' | 'layout',
	states: string[],
	prefix: string
): NonNullable<ComponentManifest['testing']>['cases'] {
	const suite = kind === 'page' ? `${route} view route is generated` : `${route} layout frame`;
	return appVisualViewports.flatMap(({ id: viewport }) =>
		states.map((state) => {
			const input = pageInput(kind, state);
			return {
				id: `${state}.${viewport}`,
				state,
				input,
				props: Object.keys(input),
				viewports: [viewport],
				test: {
					file: `${prefix}tests/e2e/${route}-${kind}.spec.ts`,
					title: `${suite} > ${viewport} viewport > ${state}`
				},
				expected: {
					kind: 'screenshot' as const,
					file: `${prefix}.cache/harness/visual-baselines/${route}-${kind}.spec.ts/${route}-${kind}-${state === 'error-state' ? 'error' : state}-${viewport}.png`
				}
			};
		})
	);
}

function pageInput(kind: 'page' | 'layout', state: string): Record<string, string> {
	if (kind === 'layout') return { children: 'Child content placeholder' };
	return state === 'default' ? {} : { error: 'Preview error' };
}

function pageScenario(
	unit: ComponentManifest,
	route: string,
	location: { root: string; build: string }
): ScenarioManifest {
	const states = unit.testing!.states!;
	return {
		schemaVersion: 1,
		id: unit.scenarios[0],
		title: `${unit.title} ${unit.kind} states`,
		kind: 'ui',
		units: [unit.id],
		states: states.map((id) => ({ id, title: id, coverage: 'required' })),
		viewports: appVisualViewports.map((viewport) => ({ ...viewport })),
		tests: [
			{
				id: unit.kind,
				kind: 'e2e',
				runner: 'playwright',
				target: `tests/e2e/${route}-${unit.kind}.spec.ts`,
				...(location.root === '.' ? {} : { cwd: location.root }),
				cases: unit.testing!.cases.map(({ id }) => ({ unit: unit.id, case: id }))
			}
		],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states,
				viewports: appVisualViewports.map(({ id }) => id),
				provenance: 'actual-capture',
				build: location.build,
				capture: 'full-page',
				required: true
			}
		]
	};
}
