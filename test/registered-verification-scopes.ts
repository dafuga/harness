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

/** Registered scenario mappings, kept in their existing precedence order. */
export const registeredVerificationScopes: Record<string, VerificationScope> = {
	'game-authoring': {
		package: 'desktop',
		vitest: {},
		playwright: { 'tests/e2e/game-native.spec.ts': gameScenario.states.map((state) => state.id) }
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
	...moduleTaskVerificationScopes
};
