import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type { CacheStatus } from '../../../models/projects-sessions/ProjectContext.types';
import type { ProjectContext } from '../../../models/projects-sessions/ProjectContext.types';

export type Reads = Pick<
	DesktopBridge,
	'listProjects' | 'selectProject' | 'capabilities' | 'snapshot' | 'entity' | 'source'
> &
	Pick<DesktopBridge, 'image' | 'messages' | 'history' | 'evidence' | 'artifact'>;

export type Listener = (event: CacheStatus) => void;

/** Runs a read of one project and, when it is refused, says so before the refusal is thrown. */
export type Guard = <T>(context: ProjectContext, read: (base: string) => Promise<T>) => Promise<T>;

export type Denied = Pick<
	DesktopBridge,
	'createPlan' | 'openThread' | 'approve' | 'providers' | 'startRun' | 'cancelRun'
>;
