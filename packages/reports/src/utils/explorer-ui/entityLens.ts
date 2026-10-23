import type {
	ExplorerBehavior,
	ExplorerCategory,
	ExplorerEvidence,
	ExplorerEntity,
	ExplorerHistoryRow,
	ExplorerLocation,
	ExplorerRelations
} from '../../models/explorer-ui/Explorer.types';
import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';

/**
 * What the host works out for the content. The content decides none of it: which commits
 * belong to the history of an entity, what proves it and what it relates to are answered by the
 * host, from the one history it holds, and the content renders the answers.
 */
export interface EntityLens {
	/** The full address of a location, so that every link is a real one. */
	href(to: ExplorerLocation): string;
	relations(id: string): ExplorerRelations;
	/** The captures an entity is shown with: one side at the tip, the parent's and its own at a commit. */
	evidence(unit: HarnessUnit): ExplorerEvidence;
	/** The headless results of an entity on both sides and whether they differ. */
	behavior(unit: HarnessUnit): ExplorerBehavior;
	/** The shown commit and its ancestors as the history knows them for an entity, newest first. */
	history(id: string): ExplorerHistoryRow[];
}

/** How a component reaches another place: where it is, the address of a place, and going there. */
export interface EntityNav {
	/** Opens one owned file without changing the current address. */
	source?(entity: ExplorerEntity, title?: string, trigger?: HTMLElement, path?: string): void;
	route: ExplorerLocation;
	href(to: ExplorerLocation): string;
	go(to: ExplorerLocation): void;
}

export interface EntityLabel {
	title: string;
	one: string;
	subtitle: string;
}

/** The six collections, pages first, with what each is called and described as. */
export const entityLabels: Record<ExplorerCategory, EntityLabel> = {
	pages: { title: 'Pages', one: 'Page', subtitle: 'Start with the pages people use.' },
	shells: {
		title: 'Shells',
		one: 'Shell',
		subtitle: 'How the app is put together for each host: navigation around the content.'
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
		subtitle: 'The data types and schemas used by the app.'
	},
	platforms: {
		title: 'Platforms',
		one: 'Platform',
		subtitle: 'Build and deployment configuration for each app platform.'
	}
};

type Target = Partial<
	Pick<ExplorerLocation, 'commit' | 'category' | 'entity' | 'helper' | 'section' | 'tab'>
>;

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

/** @pure */
export const shortCommit = (commit: string): string => commit.slice(0, 7);
