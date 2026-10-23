import type { PublicRoute } from '../../../models/networking-security/RelayHost.types';

export type HostRoute = Exclude<PublicRoute, { kind: 'health' }>;
