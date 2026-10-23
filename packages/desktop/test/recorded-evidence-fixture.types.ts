import type { VerifyRepo } from '../../../test/support/verifyRepo';
import type { IndexedCommits } from '../../../test/support/historyIndexFixture';
import type { DesktopBridge } from '../src/models/DesktopBridge.types';
import type { ProjectSessionService } from '../src/services/ProjectSessionService';

export interface Recorded {
	repo: VerifyRepo;
	root: string;
	commits: IndexedCommits & { merged: string };
}

export interface At {
	commit: string;
	branch: string;
	mode: 'current' | 'commit';
}

export type Reads = Required<Pick<DesktopBridge, 'evidence' | 'artifact'>>;

export type Opened = Reads & { session: ProjectSessionService; projectId: string };
