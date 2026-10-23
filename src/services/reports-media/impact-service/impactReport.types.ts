import type { ImpactSide } from '../../../core/development-tooling/impactTypes';
import type { ImpactSeeds } from '../../../utils/reports-media/impactSeeds';
import type { ImpactOutput } from '../../../core/execution-runtimes/kernelTypes';

export interface Assembly {
	sides: { base: ImpactSide; head: ImpactSide };
	seeds: ImpactSeeds;
	output: ImpactOutput;
}
