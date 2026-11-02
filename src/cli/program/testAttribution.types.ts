// @harness-uid u_76b76sztpq
import type { GraphEdge } from '../../core/development-tooling/sourceTypes';
import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';

export interface TestDependency {
	file: string;
	/** One shortest dependency path, from this test to the inspected unit or its source. */
	path: GraphEdge[];
	dependency: 'runtime' | 'type-only' | 'unknown';
}

export interface TestAttribution {
	/** File references only; a direct import does not establish which assertions execute it. */
	directImports: TestDependency[];
	/** Conservative reverse reachability excluding files already listed as direct imports. */
	transitiveImpacts: TestDependency[];
	/** Authored declarations only, without an execution verdict. */
	scenarios: Array<Pick<ScenarioManifest, 'id' | 'tests' | 'evidence'>>;
}
