import type { RemoteNativeStatus } from '../../../models/development-tooling/Environment.types';

export type Words = (host: string, status: RemoteNativeStatus) => { title: string; detail: string };
