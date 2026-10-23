import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
import type { ContractGroup } from '../../../utils/explorer-ui/contractFields';

export type Item = HarnessUnit['contract']['inputs'][number];

/** One callable as its contract shows it: its signature, parameters, return and errors. */
export interface CallableContract {
	name: string;
	signature: string;
	groups: ContractGroup[];
}
