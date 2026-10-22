import type { ExplorerScope } from '../../models/explorer-ui/Explorer.types';

export type ExplorerResolved =
	| { kind: 'scope'; scope: ExplorerScope }
	/** The history does not hold what the address names; nothing else is shown in its place. */
	| { kind: 'missing'; message: string };

export { explorerScope } from './harness-page/explorerScope';
