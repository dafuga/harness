import type { RuntimeChoiceInput } from '../../src/utils/execution-runtimes/chooseRuntime.types';

/**
 * chooseRuntime is called the way UnitRuntimeService calls it: the measurements of one workload and
 * profile go in, and the runtime it chose comes back with its candidates and exclusions. Each state
 * is one behaviour the contract shows; its cases are what was given and what was returned.
 */
export type RecordedMeasurement = RuntimeChoiceInput['measurements'][number];
