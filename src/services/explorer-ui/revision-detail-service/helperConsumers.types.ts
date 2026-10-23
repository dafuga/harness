import type { RevisionRegistry } from '../../../utils/verification-evidence/revision-registry/revisionRegistry';
import type { UnitsConfig } from '../../../core/development-tooling/unitsConfig';
import type { HelperFacts } from '../../../utils/explorer-ui/helperReferences';

export type Unit = RevisionRegistry['units'][number];

export interface Context {
	units: Unit[];
	config: UnitsConfig;
	paths: Set<string>;
	facts: Map<string, HelperFacts>;
	helpers: Set<string>;
	services: Map<string, string>;
	resolved: Map<string, string | undefined>;
}
