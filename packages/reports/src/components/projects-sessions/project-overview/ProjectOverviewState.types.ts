// @harness-uid u_vfxty6iyq5
import type { ProjectState } from '../../../lib/projects-sessions/project-overview/projectOverview.types';

/** The badge of one project state; its shape and words are shown, never its colour alone. */
export interface ProjectOverviewStateProps {
	state: ProjectState;
}
