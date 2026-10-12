import type {
	Environment,
	EnvironmentHost,
	RemoteDesktopControl
} from '../models/Environment.types';

export interface ElectronEnvironmentAdapterConfig {
	host: EnvironmentHost;
}

const control: (keyof RemoteDesktopControl)[] = [
	'status',
	'enable',
	'disable',
	'createPairing',
	'approvePairing',
	'denyPairing',
	'revokeDevice',
	'onStatus'
];

/**
 * The desktop app. The preload owns both objects and what is behind them, a local WebSocket to
 * the main process. The page takes them as they are and offers phone access only when the
 * control port is whole.
 */
export class ElectronEnvironmentAdapter {
	constructor(private readonly config: ElectronEnvironmentAdapterConfig) {}

	connect(): Environment {
		const { harness, harnessRemote } = this.config.host;
		const whole = control.every((name) => typeof harnessRemote?.[name] === 'function');
		return {
			kind: 'electron',
			bridge: harness,
			local: true,
			host: whole ? (harnessRemote as RemoteDesktopControl) : undefined
		};
	}
}
