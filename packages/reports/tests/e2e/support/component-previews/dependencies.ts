import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { ProjectDependencies } from '../../../../../../src/services/explorer-ui/revision-detail-service/projectDependencies.types';
export const dependencyData: ProjectDependencies = {
	gaps: [],
	entries: [
		{
			name: 'zod',
			version: '^4.0.0',
			kind: 'runtime',
			ecosystem: 'npm',
			workspace: 'api',
			source: 'packages/api/package.json'
		},
		{
			name: 'zod',
			version: '^4.0.0',
			kind: 'runtime',
			ecosystem: 'npm',
			workspace: 'web',
			source: 'packages/web/package.json'
		},
		{
			name: 'zod',
			version: '^3.0.0',
			kind: 'runtime',
			ecosystem: 'npm',
			workspace: 'legacy',
			source: 'packages/legacy/package.json'
		},
		{
			name: 'typescript',
			version: '^5.8.0',
			kind: 'development',
			ecosystem: 'npm',
			workspace: 'root',
			source: 'package.json'
		},
		{
			name: 'serde',
			version: '1',
			kind: 'runtime',
			ecosystem: 'cargo',
			workspace: 'core',
			source: 'crates/core/Cargo.toml'
		}
	]
};
export function dependencyPreview(host: ExplorerScreenProps): ExplorerScreenProps {
	const route = {
		...host.route,
		category: 'pages' as const,
		screen: 'dependencies' as const,
		entity: undefined
	};
	return {
		...host,
		head: { ...host.head, projectDependencies: dependencyData },
		route,
		scope: { ...host.scope, location: route }
	};
}
