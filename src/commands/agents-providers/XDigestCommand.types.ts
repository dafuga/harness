// @harness-uid u_53bgisvajn
import type { XDigestRunInput } from '../../workflows/agents-providers/runXDigest.types';

export type XDigestCommandOptions = Omit<XDigestRunInput, 'wait'> & { wait?: number };

export type XDigestAction = 'collect' | 'send' | 'identity';
