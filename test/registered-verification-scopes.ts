import { registryOwnershipVerificationScopes } from './registry-ownership-verification-scopes';
import { uploadVerificationScopes } from './upload-verification-scopes';
import gameScenario from '../specification/scenarios/game-authoring.json' with { type: 'json' };
import { hostedVerificationScopes } from './hosted-verification-scopes';
import { functionVerificationScopes } from './function-verification-scopes';
import { recordedEvidenceScopes } from './recorded-evidence-scopes';
import { remoteVerificationScopes } from './remote-verification-scopes';
import { sharedCaseVerificationScopes } from './shared-case-verification-scopes';
import { agentCreationVerificationScopes } from './agent-creation-verification-scopes';
import { searchVerificationScopes } from './search-verification-scopes';
import { shellsVerificationScopes } from './shells-verification-scopes';
import { referenceVerificationScopes } from './reference-verification-scopes';
import { designOptionVerificationScopes } from './design-option-verification-scopes';
import { planFixtureVerificationScopes } from './plan-fixture-verification-scopes';
import { hubDesignVerificationScopes } from './hub-design-verification-scopes';
import { brandingVerificationScopes } from './branding-verification-scopes';
import { historyFixtureVerificationScopes } from './history-fixture-verification-scopes';
import { moduleTaskVerificationScopes } from './module-task-verification-scopes';
import type { VerificationScope } from './verification-targets';

/** The authoring spec's tests cover creation, mechanics, the checkpoint graph, saved and reopened graphs, history and play. */
const gameAuthoringStates = [
	'2d-creation',
	'3d-creation',
	'2d-mechanics',
	'3d-mechanics',
	'checkpoint-map',
	'2d-fit-graph',
	'3d-fit-graph',
	'2d-saved',
	'3d-saved',
	'2d-reopened',
	'3d-reopened',
	'2d-history',
	'3d-history',
	'2d-play',
	'3d-play'
];
/** The lifecycle spec covers brief retention, rejected late answers, approval after regeneration and the level review. */
const levelLifecycleStates = [
	'level-brief-2d',
	'level-brief-3d',
	'level-stale-2d',
	'level-stale-3d',
	'level-review-2d',
	'level-review-3d',
	'level-approved-2d',
	'level-approved-3d'
];

/** Registered scenario mappings, kept in their existing precedence order. */
export const registeredVerificationScopes: Record<string, VerificationScope> = {
	'game-authoring': {
		package: 'desktop',
		vitest: {},
		playwright: {
			'tests/e2e/game-native.spec.ts': gameScenario.states.map((state) => state.id),
			'tests/e2e/game-authoring.spec.ts': gameAuthoringStates,
			'tests/e2e/game-level-lifecycle.spec.ts': levelLifecycleStates
		}
	},
	...remoteVerificationScopes,
	...recordedEvidenceScopes,
	...hostedVerificationScopes,
	...functionVerificationScopes,
	...sharedCaseVerificationScopes,
	...agentCreationVerificationScopes,
	...searchVerificationScopes,
	...shellsVerificationScopes,
	...referenceVerificationScopes,
	...designOptionVerificationScopes,
	...planFixtureVerificationScopes,
	...hubDesignVerificationScopes,
	...brandingVerificationScopes,
	...historyFixtureVerificationScopes,
	...moduleTaskVerificationScopes,
	...uploadVerificationScopes,
	...registryOwnershipVerificationScopes
};
