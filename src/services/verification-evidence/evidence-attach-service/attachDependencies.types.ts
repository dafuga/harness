// @harness-uid u_q33nfdq3id
import type { RecordLinks } from '../../../utils/development-tooling/recordLineage.types';
export interface DependentRecord extends RecordLinks {
	id: string;
	failures: string[];
}
