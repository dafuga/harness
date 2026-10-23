/** What a Plan may ask for: 1 to 10 design options, 3 unless the person chooses another. */
export const designCounts = Array.from({ length: 10 }, (_, index) => index + 1);

export const defaultDesignCount = 3;

/** Pages, shells and components are planned as images; every other kind as notes and cases. */
export function visualCategory(category: string): boolean {
	return ['pages', 'layouts', 'components'].includes(category);
}

export { composeModes } from '../../components/explorer-ui/thread-panel/composeModes';

export type { ComposeMode, AgentChoice, RunDraft } from './composeModes.types';
