import type { RemoteDesktopControl } from '../../../../../remote/src/index';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';

export type LocalControl = Omit<RemoteDesktopControl, 'onStatus'>;

export interface LocalOperationsOptions {
	bridge: Omit<DesktopBridge, 'onRunEvent'>;
	control: LocalControl;
}

export type Fields = Record<string, unknown>;

export type Operation = (input?: unknown) => Promise<unknown>;
