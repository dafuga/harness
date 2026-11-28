// @harness-uid u_n2zqdgcimk
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type { DeviceApprovalAction } from '../../../models/development-tooling/Environment.types';

export type Actor = NonNullable<NativeHostedStatus['actor']>;
export type Command = DeviceApprovalAction | { action: 'status' };
