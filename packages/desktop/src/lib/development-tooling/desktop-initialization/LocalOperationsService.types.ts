// @harness-uid u_dhwgyywtay
import type { RemoteDesktopControl } from '../../../../../remote/src/index';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';

export { DesktopOperationUnavailableError } from './DesktopOperationUnavailableError';

export type LocalControl = Omit<RemoteDesktopControl, 'onStatus'>;

export interface LocalOperationsOptions {
	bridge: Omit<DesktopBridge, 'onRunEvent'>;
	control: LocalControl;
	/** Present only when a Hub is configured: the overview then comes from the Hub, never the local tracker. */
	hubOverview?: () => Promise<OverviewSnapshot>;
	outgoingDrafts?: (input: Fields) => Promise<unknown>;
	home?: DesktopBridge['homeSnapshot'];
	homeChat?: (input: unknown) => ReturnType<NonNullable<DesktopBridge['homeChat']>>;
}

export type Fields = Record<string, unknown>;

export type Operation = (input?: unknown) => Promise<unknown>;
