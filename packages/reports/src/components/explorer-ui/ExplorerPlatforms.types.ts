import type { platformViews } from '../../utils/explorer-ui/explorer-platforms/platformStatus';
import type { platformStatus } from '../../utils/explorer-ui/explorer-platforms/platformStatus';
import type { PlatformEntry } from '../../../../../src/core/explorer-ui/Platform.types';

export type Card = (typeof platformViews)[number] & {
	entry?: PlatformEntry;
	status: ReturnType<typeof platformStatus>;
	tally: string;
};
