import type { TaskAuditInput } from '../../services/verification-evidence/TaskCompletionService';

export interface Flags {
	kind?: TaskAuditInput['kind'];
	goal?: string;
	plan?: string;
	loop?: string;
	units?: string;
	json?: boolean;
}
