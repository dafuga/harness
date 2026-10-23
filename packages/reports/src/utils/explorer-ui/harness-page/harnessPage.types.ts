import type { ExplorerScope } from '../../../models/explorer-ui/Explorer.types';

export type HarnessPage =
	/** The address stands for another one: the root, an earlier page, a branch or commit alone. */
	| { kind: 'redirect'; path: string }
	/** Nothing in this history is at the address; `home` is where the explorer opens, if anywhere. */
	| { kind: 'missing'; message: string; home: string | null }
	| { kind: 'page'; scope: ExplorerScope };
