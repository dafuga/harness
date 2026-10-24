import type { DesktopCase } from './desktopData.svelte';
import { providers } from './desktopData.svelte';
import { children, done, noop, text, image } from './shared';
import { routeIds } from './routeUnits';
import { live } from './activity';
import { ids } from './explorerData';
export const desktopControls: Record<string, DesktopCase> = {
	'desktop.component.agent-controls': () => ({
		providers,
		choice: { provider: 'codex', model: 'preview-model', effort: 'high' },
		action: text('<button>Ask agent</button>')
	}),
	'desktop.component.agent-effort-picker': () => ({ efforts: ['high', 'xhigh'], effort: 'high' }),
	'desktop.component.agent-model-picker': () => ({
		providers,
		provider: 'codex',
		model: 'preview-model'
	}),
	'desktop.component.agent-settings': () => ({}),
	'desktop.component.agents-providers-chat-agents': (d) => {
		d.bridge.agentActivity = async () => ({
			sampledAt: new Date().toISOString(),
			agents: {
				...live.agents,
				tracking: 'available',
				roster: live.agents.roster.map((agent) => ({
					...agent,
					state: 'working',
					units: [ids.card],
					expiresAt: new Date(Date.now() + 900_000).toISOString()
				}))
			}
		});
		return { workspace: d.workspace };
	},
	'desktop.component.annotated-image': (d) => ({
		src: image,
		title: 'Activity list',
		threads: [d.thread],
		writable: true,
		comment: noop,
		select: noop
	}),
	'desktop.component.approval-button': (d) => ({
		entity: d.entity,
		workspace: d.workspace,
		design: d.design,
		approved: false
	}),
	'desktop.component.catalog-view': (d) => ({ workspace: d.workspace }),
	'desktop.component.choice-dialog': () => ({
		label: 'Choose a model',
		title: 'Models',
		width: 420,
		maxHeight: 360,
		icon: text('<span>Model</span>'),
		children: text('<button>Preview model</button>')
	}),
	'desktop.component.composer': () => ({
		modes: ['comment', 'plan', 'change'],
		providers,
		approved: true,
		running: false,
		comment: done,
		send: done
	}),
	'desktop.component.contract-panel': (d) => ({ contract: d.entity.contract }),
	'desktop.component.coverage-panel': (d) => ({
		entity: d.filterEntity,
		evidence: d.evidence,
		workspace: d.workspace
	}),
	'desktop.component.design-panel': (d) => ({
		entity: d.entity,
		workspace: d.workspace,
		annotatable: true,
		version: 'v001',
		onthread: noop,
		onannotate: done
	}),
	'desktop.component.details-panel': (d) => ({ entity: d.entity, workspace: d.workspace }),
	'desktop.component.entity-card': (d) => ({ entity: d.entity, workspace: d.workspace }),
	'desktop.component.entity-view': (d) => ({ workspace: d.workspace }),
	'desktop.component.history-panel': (d) => ({
		entity: d.filterEntity,
		workspace: d.workspace,
		evidence: d.evidence
	}),
	'desktop.component.hosted-connection': (d) => ({ workspace: d.workspace }),
	'desktop.component.icon': () => ({ name: 'components', size: 48 }),
	'desktop.component.image-thumbnail': (d) => ({
		workspace: d.workspace,
		entityId: d.entity.id,
		version: 'v001',
		sha256: d.design.images[0].sha256,
		title: 'Activity list design'
	}),
	'desktop.component.measures-panel': () => ({
		size: { available: true, text: '2 KB' },
		performance: { available: true, text: '0.8 ms · browser render' }
	}),
	'desktop.component.message-list': (d) => ({
		messages: [d.message],
		workspace: d.workspace,
		entity: d.entity
	}),
	'desktop.component.nav-bar': (d) => ({ workspace: d.workspace }),
	'desktop.component.plan-badge': () => ({ label: 'Plan' }),
	'desktop.component.prior-image': (d) => ({
		workspace: d.workspace,
		entityId: d.entity.id,
		version: 'v001',
		sha256: d.design.images[0].sha256,
		title: 'Previous activity design'
	}),
	'desktop.component.project-agent': (d) => ({ workspace: d.workspace, open: true }),
	'desktop.component.project-gate': () => ({
		available: false,
		local: true,
		busy: false,
		open: noop,
		projects: [],
		choose: noop,
		children
	}),
	'desktop.component.project-switcher': (d) => ({ workspace: d.workspace }),
	'desktop.component.recorded-preview': (d) => ({
		workspace: d.workspace,
		entityId: d.visual.scope.location.entity,
		title: 'Order card',
		thumbnail: { source: 'recorded', scenario: 'order-card', state: 'default', viewport: 'desktop' }
	}),
	'desktop.component.reference-text': (d) => ({
		text: 'Review [[unit:app.page.orders]] before requesting a change.',
		workspace: d.workspace,
		entity: d.entity
	}),
	'desktop.component.relationships-panel': (d) => ({
		relationships: [
			{
				id: 'app.page.orders',
				title: 'Orders page',
				category: 'pages',
				direction: 'used-by',
				hasPlan: false,
				verification: 'verified'
			},
			{
				id: routeIds.shell,
				title: 'OrdersFrame',
				category: 'layouts',
				direction: 'used-by',
				hasPlan: false,
				verification: 'unknown'
			}
		],
		workspace: d.workspace,
		direction: 'used-by'
	}),
	'desktop.component.revision-picker': (d) => ({ workspace: d.workspace }),
	'desktop.component.run-status': (d) => ({
		text: 'Capturing component screenshots…',
		active: true,
		cancel: noop,
		workspace: d.workspace
	}),
	'desktop.component.segmented-choice': () => ({
		value: 'desktop',
		options: ['desktop', 'tablet', 'mobile'],
		label: 'Viewport'
	}),
	'desktop.component.status-bar': (d) => ({ workspace: d.workspace }),
	'desktop.component.status-icon': () => ({
		status: 'verified',
		reason: 'All required component states passed.'
	}),
	'desktop.component.thread-history': (d) => ({
		entity: d.entity,
		workspace: d.workspace,
		version: 'v001',
		select: noop
	}),
	'desktop.component.thread-links': (d) => ({
		threads: [d.thread],
		thread: d.thread,
		aim: d.thread,
		select: noop
	}),
	'desktop.component.thread-panel': (d) => ({
		entity: d.entity,
		workspace: d.workspace,
		thread: d.thread,
		version: 'v001',
		close: noop
	}),
	'desktop.component.workspace-link': (d) => ({
		workspace: d.workspace,
		to: '/projects/preview/components',
		children: text('<span>Components</span>')
	}),
	// The desktop app supplies no account controls; a host app passes its own.
	'desktop.component.workspace-shell': (d) => ({ workspace: d.workspace })
};
