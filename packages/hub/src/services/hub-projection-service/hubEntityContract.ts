import type { ComponentManifest } from '../../../../../src/core/unitTypes';
import type { PlanRecord } from '../../../../desktop/src/models/PlanningPort.types';
import { hubContractHash } from '../../utils/hubJson';

export async function hubEntityContract(
	unit?: Pick<ComponentManifest, 'contract'>,
	plan?: Pick<PlanRecord, 'contract'>
) {
	if (plan) return plan.contract;
	if (!unit) return { inputs: [], outputs: [], errors: [], hash: null };
	return { ...unit.contract, hash: await hubContractHash(unit.contract) };
}
