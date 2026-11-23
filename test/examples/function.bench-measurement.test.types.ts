import type { sizeMeasurements } from '../../src/cli/program/run-kernel-bench/benchMeasurement';
import type { benchMeasurement } from '../../src/utils/verification-evidence/benchMeasurement';

export type Build = Parameters<typeof sizeMeasurements>[1];

export type Measurement = ReturnType<typeof benchMeasurement>;
