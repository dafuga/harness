// @harness-uid u_kg5hqf7tuv
import { ProjectAssistantError } from '../../core/agents-providers/ProjectAssistantError';
import type { HealthProbeResult } from './HealthProbeAdapter.types';

/** Fetches only the named HTTPS health URLs it was configured with. */
export class HealthProbeAdapter {
	constructor(
		private readonly targets: Readonly<Record<string, string>>,
		private readonly call: typeof fetch = fetch
	) {
		for (const url of Object.values(targets))
			if (URL.parse(url)?.protocol !== 'https:')
				throw new ProjectAssistantError('Health URLs must use HTTPS.');
	}

	names(): string[] {
		return Object.keys(this.targets);
	}

	async probe(name: string): Promise<HealthProbeResult> {
		const url = this.targets[name];
		if (!url) throw new ProjectAssistantError('Unknown health target.');
		const started = Date.now();
		try {
			const response = await this.call(url, {
				method: 'GET',
				redirect: 'manual',
				signal: AbortSignal.timeout(8000)
			});
			return { name, url, status: response.status, latencyMs: Date.now() - started };
		} catch {
			return { name, url, status: 'unreachable', latencyMs: Date.now() - started };
		}
	}
}

export type { HealthProbeResult } from './HealthProbeAdapter.types';
