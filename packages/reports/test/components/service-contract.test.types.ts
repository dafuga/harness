import type { HarnessUnit } from '../../src/models/explorer-ui/Harness.types';

export type Manifest = Pick<HarnessUnit, 'owns' | 'contract' | 'runtime'>;
