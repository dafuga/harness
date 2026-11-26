// @harness-uid u_44u5mzzjmu
import type { RevisionUnit } from '../../../utils/verification-evidence/revision-registry/revisionRegistry.types';

import type { UnitsConfig } from '../../../core/development-tooling/unitsConfig';
import type { HelperFacts } from '../../../utils/explorer-ui/helperReferences';

export interface Context {
	units: RevisionUnit[];
	config: UnitsConfig;
	paths: Set<string>;
	facts: Map<string, HelperFacts>;
	helpers: Set<string>;
	services: Map<string, string>;
	resolved: Map<string, string | undefined>;
}
