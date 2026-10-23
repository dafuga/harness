import type { RemoteDesktopControl } from '../../../models/development-tooling/Environment.types';
import type { RemoteHostState } from './remoteHost.svelte';

export type Approval = Parameters<RemoteDesktopControl['approvePairing']>[0];

export type RemoteHost = RemoteHostState;
