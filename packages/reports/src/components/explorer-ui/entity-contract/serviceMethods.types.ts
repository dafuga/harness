import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';

export type Item = HarnessUnit['contract']['inputs'][number];

export type Recorded = NonNullable<HarnessUnit['serviceClasses']>[number];

/** A class of a service and the methods its contract is read by, its constructor first. */
export interface ServiceClass {
	name: string;
	methods: string[];
}
