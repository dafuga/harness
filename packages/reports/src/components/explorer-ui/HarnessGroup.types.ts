import type { Snippet } from 'svelte';
import type { HarnessIconName } from '../../utils/explorer-ui/harnessIcons';

/** A default-open group whose mounted content survives toggles; scope changes reveal it. */
export interface HarnessGroupProps {
	title: string;
	count: number;
	icon?: HarnessIconName;
	source?: string;
	description?: string;
	level?: 2 | 3;
	variant?: 'catalog' | 'relation' | 'styles';
	resetKey?: string;
	children: Snippet;
}
