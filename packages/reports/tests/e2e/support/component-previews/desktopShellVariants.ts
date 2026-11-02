import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import { text } from './shared';
import { desktopEntitySectionFixture } from './desktopEntitySectionFixture';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';
import { desktopHistoryFixture, earlierDesktopHistoryEvent } from './desktopHistoryFixture';

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
		desktopEntitySectionFixture(data, variant);
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
		if (variant === 'helper-examples') {
			data.workspace.entity = data.filterEntity;
			data.workspace.category = 'functions';
		}
		data.workspace.suffix = (sections[variant] ?? null) as DesktopData['workspace']['suffix'];
		return props;
	}
	return workspaceControl(name, props, data, variant);
}
function catalog(props: PreviewProps, data: DesktopData, variant: string) {
	if (variant === 'empty') data.workspace.snapshot!.entities = [];
	if (variant === 'long')
		data.workspace.snapshot!.entities[0].title = 'SubscriptionRenewalNotificationPreferencesPanel';
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
			throw new Error('The saved design image could not be read.');
		};
	if (variant === 'readonly') return { ...props, annotatable: false };
	if (variant === 'empty') return { ...props, entity: { ...data.entity, versions: [] } };
	if (variant === 'headless') return { ...props, entity: data.filterEntity };
	if (variant === 'headless-plan')
		return { ...props, entity: { ...data.filterEntity, versions: data.entity.versions } };
	if (variant === 'long')
		return {
			...props,
			option: 'o1',
			entity: {
				...data.entity,
				versions: data.entity.versions.map((version) => ({
					...version,
					images: version.images.map((image) => ({ ...image, option: 'o1' })),
					options: [
						{
							id: 'o1',
							direction:
								'Keep order names and fulfilment status together so the operations team can review recent purchases, identify pending service plans and open the complete order history without losing the current selection.',
							prompt: null,
							revisedPrompt: null,
							generator: version.generator,
							imageHashes: version.images.map((image) => image.sha256)
						}
					]
				}))
			}
		};
	return props;
}
function history(props: PreviewProps, data: DesktopData, variant: string): PreviewProps {
	const entity = desktopHistoryFixture(data.filterEntity, variant);
	if (['incomplete', 'more', 'loading', 'error'].includes(variant))
		entity.historyCoverage = {
			complete: false,
			nextPage: variant === 'incomplete' ? null : 1,
			loadedPages: 1
		};
	if (variant === 'more')
		data.bridge.history = async () => ({
			entries: [earlierDesktopHistoryEvent()],
			complete: true,
			nextPage: null
		});
	if (variant === 'loading') data.bridge.history = () => new Promise(() => {});
	if (variant === 'error')
		data.bridge.history = async () => {
			throw new Error("Couldn't load earlier history. Try again.");
		};
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
			? { ...props, account: text('<button type="button">Ada Morgan</button>') }
			: props;
	},
	'project-switcher': (props, data, variant) => {
		const workspace = data.workspace;
		if (variant === 'empty') {
			workspace.projects = [];
			workspace.snapshot = null;
		}
		if (variant === 'shared') {
			workspace.projects.push({ id: 'shared-project', name: 'Orders Operations', kind: 'shared' });
			workspace.snapshot!.project.id = 'shared-project';
			workspace.snapshot!.project.name = 'Orders Operations';
		}
		if (variant === 'busy') workspace.busy = true;
		if (variant === 'long')
			workspace.snapshot!.project.name = 'Field Service Operations and Order Management';
		return props;
	},
	'revision-picker': (props, data, variant) => {
		const workspace = data.workspace;
		if (variant === 'environment') {
			workspace.deployments.statuses = [
				{
					environment: 'preprod',
					available: true,
					reason: '',
					receipt: {
						environment: 'preprod',
						commit: commits.tip,
						branch: workspace.snapshot!.revision.branch,
						updatedAt: '2026-10-20T10:00:00Z',
						adapter: 'cloudflare',
						deploymentId: 'orders-preprod-42',
						url: 'https://orders-preprod.example.invalid'
					}
				}
			];
			workspace.deployments.choose('preprod');
		}
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
