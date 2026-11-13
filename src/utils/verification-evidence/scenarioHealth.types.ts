import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';

/** The unit facts the report needs; retired units are not expected to be in any scenario. */
export interface HealthUnit {
	id: string;
	kind: string;
	status: 'active' | 'retired';
}

export interface ScenarioHealthInput {
	scenarios: ScenarioManifest[];
	units: HealthUnit[];
}

/** One size a viewport id is used at, with the scenarios that use it. */
export interface ViewportSize {
	width: number;
	height: number;
	scale?: number;
	scenarios: string[];
}

export interface ScenarioHealth {
	scenarios: number;
	viewports: {
		/** The ids the documentation promises; anything else is reported as unknown. */
		known: string[];
		unknown: Array<{ id: string; scenarios: string[] }>;
		/** Ids used at more than one size across scenarios, each size with its scenarios. */
		conflicts: Array<{ id: string; sizes: ViewportSize[] }>;
	};
	/** How many states of all scenarios are required, missing or inapplicable. */
	coverage: Record<ScenarioManifest['states'][number]['coverage'], number>;
	/** Active units that no scenario covers, split by kind of unit. */
	noScenario: {
		total: number;
		retired: number;
		counts: { components: number; pages: number; other: number };
		components: string[];
		pages: string[];
		other: string[];
		/** Counts by `package.kind`, for the kinds that matter most (components and pages). */
		byPrefix: Record<string, number>;
	};
}
