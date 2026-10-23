import type { EntityLabel, Target } from './entityLens.types';
import type { ExplorerCategory, ExplorerLocation } from '../../models/explorer-ui/Explorer.types';

/** Each collection, pages first, with its name and description. */
export const entityLabels: Record<ExplorerCategory, EntityLabel> = {
	pages: { title: 'Pages', one: 'Page', subtitle: 'Start with the pages people use.' },
	layouts: {
		title: 'Layouts',
		one: 'Layout',
		subtitle: 'Reusable page frames with a clearly marked child-content area.'
	},
	components: {
		title: 'Components',
		one: 'Component',
		subtitle: 'Reusable pieces of the app, at any level.'
	},
	functions: {
		title: 'Helpers',
		one: 'Helper',
		subtitle: 'Pure, reusable functions. Same inputs, same result; no side effects.'
	},
	configs: {
		title: 'Configs',
		one: 'Config',
		subtitle: 'The settings and budgets that shape the app.'
	},
	services: {
		title: 'Services',
		one: 'Service',
		subtitle: 'Single-purpose capabilities behind the app.'
	},
	models: {
		title: 'Models',
		one: 'Model',
		subtitle: 'Persisted data models and their database schemas.'
	},
	types: {
		title: 'Types',
		one: 'Type',
		subtitle: 'Shared interfaces and type aliases used by the app.'
	},
	platforms: {
		title: 'Platforms',
		one: 'Platform',
		subtitle: 'Build and deployment configuration for each app platform.'
	}
};

/**
 * Another place of the same branch and the same revision mode. The branch is always kept and
 * the commit is kept unless the target names one of its own, so no link leaves the scope it is
 * shown in. A section and a tab belong to the entity they were opened on and are not carried to
 * another place.
 */
export function entityLens(from: ExplorerLocation, to: Target): ExplorerLocation {
	const place: ExplorerLocation = {
		branch: from.branch,
		commit: to.commit === undefined ? from.commit : to.commit,
		category: to.category ?? from.category
	};
	if (!to.entity) return place;
	place.entity = to.entity;
	const helper = to.helper ?? (to.entity === from.entity ? from.helper : undefined);
	if (helper && place.category === 'functions') place.helper = helper;
	if (to.section) place.section = to.section;
	if (to.tab) place.tab = to.tab;
	return place;
}

export { shortCommit } from '../../helpers/strings/shortCommit';
export type { EntityLens, EntityNav, EntityLabel } from './entityLens.types';
