import type { z } from 'zod';
import type { project, registry } from './DeployManifestValidator';

export type DeployRegistry = z.infer<typeof registry>;
export type DeployProject = z.infer<typeof project>;
