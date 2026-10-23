import type { RemoteMobileStatus } from '../../../models/development-tooling/Environment.types';
import type { RemotePhoneState } from './remotePhone.svelte';

export type State = RemoteMobileStatus['state'];

export type RemotePhone = RemotePhoneState;
