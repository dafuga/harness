import { join } from "node:path";
import { homedir } from "node:os";

export function reportFiles(root?: string) {
	return root || process.env.PROJECT_REPORTS_HOME || join(homedir(), '.codex', 'project-reports');
}
