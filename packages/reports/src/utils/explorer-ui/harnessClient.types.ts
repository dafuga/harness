// @harness-uid u_l2la5zvioj
import type { HarnessIndex } from '../../models/explorer-ui/Harness.types';
import type { HarnessRevision } from '../../models/explorer-ui/Harness.types';
import type { StoredSide } from '../../../../../src/utils/explorer-ui/sideImpact';
import type { ProjectActivity } from '../../../../../src/core/activityTypes';

export interface HarnessClient {
	index(): Promise<HarnessIndex>;
	revision(commit: string): Promise<HarnessRevision>;
	/** The stored side of a source tree, by the path a revision names. */
	side(path: string): Promise<StoredSide>;
	/** What the project did, as recorded when this history was built. */
	activity(): Promise<ProjectActivity>;
}
