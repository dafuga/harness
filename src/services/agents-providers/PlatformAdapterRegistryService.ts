// @harness-uid u_yggc7q7uq6
import type { PlatformAdapter } from '../../core/agents-providers/platformAdapter.types';

const adapterKey = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Resolves only adapters explicitly installed by the trusted host. */
export class PlatformAdapterRegistryService {
	private readonly adapters = new Map<string, Map<string, PlatformAdapter>>();

	register(platform: string, installationId: string, adapter: PlatformAdapter): void {
		if (!adapterKey.test(platform) || !adapterKey.test(installationId))
			throw new TypeError('Invalid platform adapter binding.');
		const installations = this.adapters.get(platform) ?? new Map<string, PlatformAdapter>();
		if (installations.has(installationId))
			throw new TypeError('Platform adapter is already bound.');
		installations.set(installationId, adapter);
		this.adapters.set(platform, installations);
	}

	resolve(platform: string, installationId: string): PlatformAdapter {
		const adapter = this.adapters.get(platform)?.get(installationId);
		if (!adapter) throw new TypeError('Platform adapter binding is unavailable.');
		return adapter;
	}
}
