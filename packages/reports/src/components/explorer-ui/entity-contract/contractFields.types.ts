// @harness-uid u_plxodrc2ry

import type { ContractGroup } from '../../../utils/explorer-ui/contractFields';

/** One callable as its contract shows it: its signature, parameters, return and errors. */
export interface CallableContract {
	name: string;
	signature: string;
	groups: ContractGroup[];
}
