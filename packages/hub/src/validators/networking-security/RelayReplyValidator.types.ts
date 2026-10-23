import type { RemoteHostSummary } from '../../../../remote/src/models/RemoteRelay.types';

export type Fields = Record<string, unknown>;

export type Device = RemoteHostSummary['devices'][number];
