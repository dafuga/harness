import { type Category } from '../../models/development-tooling/Desktop.types';
import type { ProposedContract } from '../../models/development-tooling/DesktopBridge.types';

/** What an agent may propose for something new: its kind, name, goal, notes and contract. */
export interface ProjectProposal {
	category: Category;
	title: string;
	goal: string;
	proposal: string;
	contract: ProposedContract;
}

export {
	projectProposal,
	proposalPrompt
} from '../../services/agents-providers/desktop-run-service/project-run-service/projectProposal';
