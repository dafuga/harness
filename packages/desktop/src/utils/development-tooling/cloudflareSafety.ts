import type { DeploymentConfig } from '../../models/development-tooling/Deployment.types';
/** Route overlap is an environment boundary, independent of a Worker's name. */
export function cloudflareSafety(
	config: Record<string, unknown>,
	targets: DeploymentConfig['targets']
) {
	const environments = (config.env ?? {}) as Record<string, Record<string, unknown>>;
	const protectedHosts = hosts(config);
	for (const name of ['prod', 'production'])
		protectedHosts.push(...hosts(environments[name] ?? {}, config));
	const configured = Object.values(targets).filter((target) => target.kind === 'workers');
	const production = configured.find((target) => target.environment === 'prod');
	if (production)
		protectedHosts.push(...hosts(environments[production.wranglerEnvironment] ?? {}, config));
	for (const target of configured.filter((target) => target.environment !== 'prod')) {
		const selected = hosts(environments[target.wranglerEnvironment] ?? {}, config);
		if (selected.some((host) => host.includes('*') || protectedHosts.includes(host)))
			throw new Error(
				'A lower Worker environment inherits or overlaps a production route. Configure distinct hosts.'
			);
	}
}
function hosts(config: Record<string, unknown>, inherited: Record<string, unknown> = {}): string[] {
	const routes = config.routes ?? config.route ?? inherited.routes ?? inherited.route ?? [];
	const items = Array.isArray(routes) ? routes : [routes];
	return items.map((item) => {
		const pattern = typeof item === 'string' ? item : (item as { pattern?: unknown }).pattern;
		if (typeof pattern !== 'string') throw new Error('Cloudflare route mapping is ambiguous.');
		return new URL(pattern.includes('://') ? pattern : 'https://' + pattern).hostname;
	});
}
