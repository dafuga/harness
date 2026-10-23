import type { TaskCheck } from './task-completion-service/planAudit';

export interface TaskAuditInput {
	kind: 'coding' | 'planning';
	goal: string;
	plan?: string;
	loop?: string;
	units?: string[];
}

export interface TaskAudit {
	schemaVersion: 1;
	id: string;
	commit: string | null;
	kind: TaskAuditInput['kind'];
	goal: string;
	task: { plan: string | null; loop: string | null; units: string[] };
	passed: boolean;
	checks: TaskCheck[];
	limitation: string;
}
