import type { RemoteNativePlugin } from '../../../models/development-tooling/Environment.types';
import type { AccountNativePlugin } from '../../../models/development-tooling/Environment.types';

export interface CapacitorEnvironmentAdapterConfig {
	/** A test hands in a plugin; the app registers the native one. */
	plugin?: RemoteNativePlugin;
	/**
	 * This phone's own Hub account. A test hands one in; the app registers the native one only
	 * where the shell has it, so that an older shell keeps exactly the computer's bridge.
	 */
	account?: AccountNativePlugin;
}
