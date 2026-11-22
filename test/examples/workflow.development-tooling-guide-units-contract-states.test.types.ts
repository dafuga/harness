import type {
	contractStates,
	mergeUnitStates
} from '../../src/workflows/development-tooling/guide-units/contractStates';

export type Contract = Parameters<typeof contractStates>[0];

export type Groups = Parameters<typeof mergeUnitStates>[0];
