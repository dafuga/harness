import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import { text } from './shared';
import { commits } from '../../../../test/entityUnits';

/** Workspace state changes are confined to the catalog's synthetic store and bridge. */
export function desktopShellVariant(
	id: string,
	props: PreviewProps,
	data: DesktopData,
	variant: string
): PreviewProps | null {
	const name = id.replace('desktop.component.', '');
	if (name === 'composer') return composer(props, variant);
	if (name === 'project-gate') return gate(props, data, variant);
	if (name === 'design-panel') return design(props, data, variant);
	if (name === 'history-panel') return history(props, data, variant);
	if (name === 'catalog-view') return catalog(props, data, variant);
	if (name === 'entity-view') {
		const sections: Record<string, string> = {
			source: 'source',
			designs: 'designs',
			'used-in': 'used-in',
			uses: 'uses',
			apis: 'apis',
			states: 'states',
			history: 'history',
			'helper-examples': 'examples'
		};
		if (variant === 'helper-examples') data.workspace.entity = data.filterEntity;
		data.workspace.suffix = (sections[variant] ?? null) as DesktopData['workspace']['suffix'];
		return props;
	}
	return workspaceControl(name, props, data, variant);
}
function catalog(props: PreviewProps, data: DesktopData, variant: string) {
	if (variant === 'empty') data.workspace.snapshot!.entities = [];
	if (variant === 'long')
		data.workspace.snapshot!.entities[0].title =
			'A component with a long descriptive name for catalog wrapping';
	return props;
}

function composer(props: PreviewProps, variant: string): PreviewProps {
	const modes = ['comment', 'ask', 'plan', 'change'];
	const changes: Record<string, PreviewProps> = {
		plan: { modes },
		ask: { modes },
		change: { modes },
		'visual-plan': { modes, visual: true },
		running: {
			running: true,
			notice: 'An agent is running. Requests are paused until it finishes.'
		},
		unapproved: { modes: ['change'], approved: false },
		'no-modes': { modes: [] },
		'no-provider': { modes: ['plan'], providers: [] },
		compact: { compact: true },
		long: {
			notice:
				'This comment stays with the selected revision so reviewers can find its context later. It will be saved when you send it; it does not start an agent or change the approved design.'
		},
		retry: { comment: async () => false }
	};
	return { ...props, ...changes[variant] };
}
function gate(props: PreviewProps, data: DesktopData, variant: string): PreviewProps {
	return {
		...props,
		available: variant !== 'remote-empty',
		busy: variant === 'busy',
		local: !variant.startsWith('remote-'),
		projects: ['recent', 'remote-projects'].includes(variant) ? data.workspace.projects : []
	};
}
function design(props: PreviewProps, data: DesktopData, variant: string): PreviewProps {
	if (variant === 'loading') data.bridge.image = () => new Promise(() => {});
	if (variant === 'error')
		data.bridge.image = async () => {
			throw new Error('Synthetic image read refused.');
		};
	if (variant === 'readonly') return { ...props, annotatable: false };
	if (variant === 'empty') return { ...props, entity: { ...data.entity, versions: [] } };
	if (variant === 'headless') return { ...props, entity: data.filterEntity };
	if (variant === 'headless-plan')
		return { ...props, entity: { ...data.filterEntity, versions: data.entity.versions } };
	if (variant === 'long')
		return {
			...props,
			entity: {
				...data.entity,
				versions: data.entity.versions.map((version) => ({
					...version,
					images: [],
					options: [],
					notes: 'A detailed design direction. '.repeat(10)
				}))
			}
		};
	return props;
}
function history(props: PreviewProps, data: DesktopData, variant: string): PreviewProps {
	const entity =
		variant === 'empty' ? { ...data.filterEntity, history: [] } : { ...data.filterEntity };
	if (['incomplete', 'more', 'loading', 'error'].includes(variant))
		entity.historyCoverage = {
			complete: false,
			nextPage: variant === 'incomplete' ? null : 1,
			loadedPages: 1
		};
	if (variant === 'more')
		data.bridge.history = async () => ({
			entries: [
				{
					...entity.history[0],
					id: 'preview-earlier-history-page',
					at: '2026-10-09T09:00:00Z',
					title: 'Earlier API decision',
					detail: 'Keep order filtering synchronous and preserve the original order of matches.',
					commit: commits.first
				}
			],
			complete: true,
			nextPage: null
		});
	if (variant === 'loading') data.bridge.history = () => new Promise(() => {});
	if (variant === 'error')
		data.bridge.history = async () => {
			throw new Error('Synthetic earlier history is unavailable.');
		};
	if (variant === 'long')
		entity.history = entity.history.map((item, index) =>
			index === 0
				? {
						...item,
						detail: [
							'A detailed history event.',
							'The revision keeps order filtering synchronous and preserves the original order of matching rows.',
							'Matching ignores letter case without changing caller-owned data.',
							'The public input matrix covers an empty query, no matches and mixed-case customer names so reviewers can compare this change with the current implementation.'
						].join(' ')
					}
				: item
		);
	return { ...props, entity };
}

const workspaceVariants: Record<
	string,
	(props: PreviewProps, data: DesktopData, variant: string) => PreviewProps
> = {
	'environment-picker': (props, data, variant) => {
		return variant === 'with-action'
			? {
					...props,
					children: text(
						'<button type="button" class="agent-icon" aria-label="Review deployment">↗</button>'
					)
				}
			: props;
	},
	'nav-bar': (props, data, variant) => {
		if (variant === 'readonly')
			data.workspace.capabilities = {
				...data.workspace.capabilities,
				agents: false,
				comments: false
			};
		if (variant === 'game') {
			data.workspace.snapshot!.project.kind = 'game';
			data.bridge.gameRead = async () => {
				throw new Error('The navigation fixture never opens a game');
			};
		}
		return variant === 'account'
			? { ...props, account: text('<button type="button">Ada Example</button>') }
			: props;
	},
	'project-switcher': (props, data, variant) => {
		const workspace = data.workspace;
		if (variant === 'empty') {
			workspace.projects = [];
			workspace.snapshot = null;
		}
		if (variant === 'shared') {
			workspace.projects.push({ id: 'shared-project', name: 'Shared workbench', kind: 'shared' });
			workspace.snapshot!.project.id = 'shared-project';
			workspace.snapshot!.project.name = 'Shared workbench';
		}
		if (variant === 'busy') workspace.busy = true;
		if (variant === 'long')
			workspace.snapshot!.project.name = 'A workbench with a long descriptive project name';
		return props;
	},
	'revision-picker': (props, data, variant) => {
		const workspace = data.workspace;
		if (variant === 'pinned' || variant === 'historical') workspace.pinned = true;
		if (variant === 'historical') {
			workspace.snapshot!.revision.atTip = false;
			workspace.snapshot!.revision.commit = commits.middle;
		}
		if (variant === 'unknown-time') workspace.snapshot!.commits = [];
		return props;
	}
};
function workspaceControl(name: string, props: PreviewProps, data: DesktopData, variant: string) {
	return workspaceVariants[name]?.(props, data, variant) ?? null;
}
