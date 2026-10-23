import type { HarnessUnit } from '../../src/models/Harness.types';

export type Manifest = Pick<HarnessUnit, 'owns' | 'contract' | 'runtime'>;
