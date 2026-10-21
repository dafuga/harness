import { CapacitorEnvironmentAdapter } from './CapacitorEnvironmentAdapter';
import { ElectronEnvironmentAdapter } from './ElectronEnvironmentAdapter';
import type {
	Environment,
	EnvironmentHost
} from '../../../models/development-tooling/Environment.types';

/**
 * Chooses the one adapter of this runtime, in a fixed order: the native shell of a phone, then
 * the preload bridge of the desktop app. Anything else is an ordinary page and gets no bridge
 * here: a hosted page brings its own, which offers human comments and no agent.
 */
export function selectEnvironment(host: EnvironmentHost): Environment {
	if (host.Capacitor?.isNativePlatform?.()) return new CapacitorEnvironmentAdapter().connect();
	if (host.harness) return new ElectronEnvironmentAdapter({ host }).connect();
	return { kind: 'web', bridge: undefined, local: false };
}
