// @harness-uid u_apj5u4ylpy
import { workspaceSections as sections } from '../../../utils/projects-sessions/workspaceRoute';
import type { Section } from './EntityView.types';
import type { EntitySectionsContext } from './entityViewSections.types';

/** Preserve canonical order and delayed category access while selecting the owner's sections. */
export function entityViewSections(
	context: EntitySectionsContext,
	headless: boolean,
	visual: boolean
): Section[] {
	return (Object.keys(sections) as Section[]).filter(
		(name) =>
			name !== (headless ? 'Designs' : 'Plan') &&
			name !== (visual ? 'Evidence' : 'States') &&
			name !== (headless ? 'Evidence' : 'Examples') &&
			(name !== 'APIs' || context.entity?.category === 'pages')
	);
}
