// @harness-uid u_h3qimurn22
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';

export type Bridge = Omit<DesktopBridge, 'onRunEvent'>;

export type HostedInput = Record<string, unknown> & { projectId: string };
