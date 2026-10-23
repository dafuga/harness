import type { ModuleGroup } from '../../../configs/development-tooling/moduleGroupsConfig';

export interface Selection {
	root: string;
	group: ModuleGroup;
	add: boolean;
}
