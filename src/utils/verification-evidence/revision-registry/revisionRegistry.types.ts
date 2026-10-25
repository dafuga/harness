import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { ScenarioManifest } from '../../../core/development-tooling/unitTypes';
import type { PublicHelper } from '../../explorer-ui/unitMetadata';
import type { UnitMetadata } from '../../explorer-ui/unitMetadata';
import type { Measurement } from '../../../core/verification-evidence/verificationTypes';
import type { UnitDocumentation } from '../../explorer-ui/unit-documentation/unitDocumentation';
import type { EmittedLimits } from '../budgetReviews';
import type { FrozenLimits } from '../budgetReviews';

export interface RevisionRegistry {
	/** False when the revision stores no unit registry; nothing is substituted for it. */
	available: boolean;
	gap?: string;
	units: Array<{
		id: string;
		kind: string;
		composition?: ComponentManifest['composition'];
		status: string;
		title: string;
		responsibility: string;
		/** Category of this revision's source folders, never inferred from today's checkout. */
		group?: { id: string; title: string };
		dependencies: Array<{ unit: string; via: string }>;
		scenarios: string[];
		/** What the unit owns and promises, as its manifest states it at this revision. */
		owns: ComponentManifest['owns'];
		contract: Pick<ComponentManifest['contract'], 'inputs' | 'outputs' | 'errors'>;
		testing?: ComponentManifest['testing'];
		helpers?: PublicHelper[];
		helperGap?: string;
		serviceExports?: UnitMetadata['serviceExports'];
		serviceConsumers?: UnitMetadata['serviceConsumers'];
		serviceClasses?: UnitMetadata['serviceClasses'];
		modelDefinitions?: UnitMetadata['modelDefinitions'];
		configValues?: UnitMetadata['configValues'];
		configControls?: ComponentManifest['configControls'];
		sourceFiles?: UnitMetadata['sourceFiles'];
		testFiles?: UnitMetadata['testFiles'];
		/** Static observations from this source commit; not a verification verdict. */
		sourceMeasurements?: Measurement[];
		documentation?: UnitDocumentation;
		catalog?: ComponentManifest['catalog'];
		preview?: ComponentManifest['preview'];
		runtime: { kind: string; targets: Array<{ kind: string; entry: string }> };
		budgets: ComponentManifest['budgets'];
		/** For a unit that emits an output: the limit each target has in the ledger of this revision. */
		emitted?: EmittedLimits;
		/** The source limits the ledger of this revision holds; absent when none was reviewed yet. */
		limits?: FrozenLimits;
		/** Changes whenever the manifest or any owned file changes; equal versions are equal units. */
		version: string;
	}>;
	scenarios: Array<{
		id: string;
		title: string;
		kind: string;
		units: string[];
		/** `units` names what a state shows, when the scenario says so for that state. */
		states: Array<{
			id: string;
			title?: string;
			coverage: string;
			reason?: string;
			units?: string[];
		}>;
		viewports: ScenarioManifest['viewports'];
		tests: Array<{
			id: string;
			kind: string;
			runner: string;
			cases?: ScenarioManifest['tests'][number]['cases'];
		}>;
		evidence: Array<{ id: string; kind: string; states: string[]; viewports: string[] }>;
	}>;
	graph: {
		nodes: Array<{ id: string; kind: 'unit' | 'scenario' }>;
		edges: Array<{ from: string; to: string; via: string }>;
	};
}
