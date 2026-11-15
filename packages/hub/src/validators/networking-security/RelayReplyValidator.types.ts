// @harness-uid u_is7zwhy6fa
import type { RemoteHostSummary } from '../../../../remote/src/models/networking-security/RemoteRelay.types';

export type Fields = Record<string, unknown>;

export type Device = RemoteHostSummary['devices'][number];
