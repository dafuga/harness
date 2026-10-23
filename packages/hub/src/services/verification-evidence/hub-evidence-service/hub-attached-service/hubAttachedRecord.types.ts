import type { HubAttachedRecord } from '../../../../utils/verification-evidence/hubAttachedRecord';

export type Manifest = NonNullable<HubAttachedRecord['manifest']>;

export type Sealed = NonNullable<HubAttachedRecord['record']>;
