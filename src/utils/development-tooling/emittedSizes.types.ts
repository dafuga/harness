// @harness-uid u_ob66wz7kqc
import type { RuntimeKind } from '../../core/development-tooling/unitTypes';

export interface Sized {
	metric: string;
	target?: RuntimeKind;
	profile?: string | null;
	workload?: string | null;
}
