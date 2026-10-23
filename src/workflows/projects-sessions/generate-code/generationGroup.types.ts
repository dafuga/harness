import type { ModuleGroup } from '../../../config/development-tooling/moduleGroupsConfig';

export interface Selection {
	root: string;
	group: ModuleGroup;
	add: boolean;
}
