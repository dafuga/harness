// @harness-uid u_zklrpmbvoe
import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';

export type Named = Pick<HarnessUnit, 'id' | 'kind' | 'title'> & Partial<Pick<HarnessUnit, 'owns'>>;
