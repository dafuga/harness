// @harness-uid u_eisvkkusk2
import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';

export type Classified = Pick<
	HarnessUnit,
	'kind' | 'owns' | 'helpers' | 'catalog' | 'modelDefinitions'
>;
