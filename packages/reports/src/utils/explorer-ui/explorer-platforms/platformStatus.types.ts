import type { PlatformId } from '../../../../../../src/core/explorer-ui/Platform.types';
import type { HarnessIconName } from '../harnessIcons';

export interface PlatformView {
	id: PlatformId;
	name: string;
	icon: HarnessIconName;
}
