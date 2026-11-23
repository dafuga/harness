import type {
	ComponentManifest,
	ScenarioManifest
} from '../../src/core/development-tooling/unitTypes';
import type {
	GuidanceContext,
	StateRegistry
} from '../../src/workflows/development-tooling/guide-units/guideUnits.types';

export const unitId = 'workflow.development-tooling-guide-units-guidance-context';

export const prefix = 'workflow-development-tooling-guide-units-guidance-context';

export const sourcePath = 'src/workflows/development-tooling/guide-units/guidanceContext.ts';

export function unitManifest(status = 'active', id = unitId): ComponentManifest {
	return {
		schemaVersion: 1,
		id,
		uid: 'u_bfad3bg4oz',
		kind: 'workflow',
		title: 'guidanceContext',
		responsibility: 'Example responsibility.',
		responsibilityOrigin: 'declared',
		status,
		owns: { source: [sourcePath], symbols: ['guidanceContext'] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [], errorStatus: 'declared' },
		dependencies: [],
		runtime: { kind: 'module', entry: sourcePath, targets: [] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	} as unknown as ComponentManifest;
}

export function scenarioFixture(
	kind: 'headless' | 'ui',
	units: string[],
	states: { id: string; coverage: string; units?: string[] }[]
): ScenarioManifest {
	const viewports = kind === 'ui' ? [{ id: 'desktop', width: 1280, height: 800 }] : [];
	const id = `guide-units.${kind}`;
	return {
		schemaVersion: 1,
		id,
		title: 'Fixture',
		kind,
		units,
		states,
		viewports,
		tests: [],
		evidence: []
	} as unknown as ScenarioManifest;
}

export function fakeContext(input: {
	stored?: ComponentManifest[];
	scenarios?: ScenarioManifest[];
	registries?: StateRegistry[];
	texts?: Record<string, string>;
	reads?: string[];
}): GuidanceContext {
	const texts = input.texts ?? {};
	const reads = input.reads ?? [];
	const tree = {
		read: async (path: string) => {
			reads.push(path);
			return texts[path] ?? '';
		}
	};
	const files = new Map([[sourcePath, { references: [] }]]);
	return {
		loaded: {
			stored: input.stored ?? [unitManifest()],
			scenarios: input.scenarios ?? [],
			index: { files },
			errors: []
		},
		tree,
		registries: input.registries ?? [],
		texts: new Map(),
		testAttributions: new Map(),
		testSyntax: new Map()
	} as unknown as GuidanceContext;
}

export function thrownBy(run: () => unknown): { name: string; message: string } {
	try {
		run();
	} catch (error) {
		return { name: (error as Error).name, message: (error as Error).message };
	}
	return { name: 'none', message: 'did not throw' };
}

export const multi = scenarioFixture(
	'headless',
	[unitId, 'workflow.other'],
	[
		{ id: `${prefix}-ready`, coverage: 'required', units: [unitId] },
		{ id: 'workflow-other-ready', coverage: 'required', units: ['workflow.other'] },
		{ id: `${prefix}-unavailable`, coverage: 'inapplicable', units: [unitId] }
	]
);

export const readyRegistry: StateRegistry = {
	entity: unitId,
	where: 'specification/required-states.json',
	kind: 'required-states',
	states: ['ready']
};
