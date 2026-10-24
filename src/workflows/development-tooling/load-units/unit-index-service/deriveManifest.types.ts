import type { ComponentManifest } from '../../../../core/development-tooling/unitTypes';

export type Declared = Pick<
	ComponentManifest,
	| 'kind'
	| 'composition'
	| 'title'
	| 'responsibility'
	| 'responsibilityOrigin'
	| 'contract'
	| 'scenarios'
	| 'preview'
	| 'helperContracts'
	| 'documentation'
	| 'catalog'
	| 'configControls'
	| 'budgets'
>;
