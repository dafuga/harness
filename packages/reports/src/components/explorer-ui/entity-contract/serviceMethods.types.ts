import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';

export type Item = HarnessUnit['contract']['inputs'][number];

export type Recorded = NonNullable<HarnessUnit['serviceClasses']>[number];

/** A service class and its declared methods, presented with CRUD actions first. */
export interface ServiceClass {
	name: string;
	methods: string[];
}
