import type { z } from 'zod';
import type { moduleGroupConfig, moduleGroupsConfig } from './moduleGroupsConfig';

export type ModuleGroup = z.infer<typeof moduleGroupConfig>;

export type ModuleGroupsConfig = z.infer<typeof moduleGroupsConfig>;
