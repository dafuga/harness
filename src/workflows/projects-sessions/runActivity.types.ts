import type { ProjectActivity } from '../../core/projects-sessions/activityTypes';
import type { LiveActivity } from '../../core/projects-sessions/activityTypes';

export interface Shown {
	activity: ProjectActivity;
	live: LiveActivity;
}
