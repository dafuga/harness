import type { UnitProject } from './unitProject';
import type { ImpactReport } from '../../src/core/impactTypes';

export interface ImpactRepo extends UnitProject {
	commit(message: string): Promise<string>;
	impact(args?: string[]): Promise<ImpactReport>;
	remove(path: string): Promise<void>;
	dispose(): Promise<void>;
}
