// @harness-uid u_62hgz5o7bv
import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';

export type Recorded = NonNullable<HarnessUnit['serviceClasses']>[number];

/** A service class and its declared methods, presented with CRUD actions first. */
export interface ServiceClass {
	name: string;
	methods: string[];
}
