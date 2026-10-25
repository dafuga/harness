import { moduleCases } from './modules';
import { dependencyPreview } from './dependencies';
import { translationPreview } from './translations';
import type { PreviewCases } from './shared';
import { children, text, names } from './shared';
import * as d from './explorerData';
import { sourceCases } from './source';
const base = { nav: d.navigation, lens: d.reading, scope: d.shown.scope, mediaBase: '/media/' };
const entity = { entity: d.entity, ...base };
const page = d.host();

const seen = {
	shown: d.run,
	side: 'after',
	title: 'Recorded results',
	role: 'Selected commit',
	mediaBase: '/media/'
};
export const explorerCases: PreviewCases = {
	...moduleCases(d.host()),
	'reports.component.explorer-dependencies-screen': dependencyPreview(
		d.host()
	) as unknown as Record<string, unknown>,
	'reports.component.explorer-ui-explorer-translations-screen': translationPreview(
		d.host()
	) as unknown as Record<string, unknown>,
	'reports.component.explorer-ui-config-value-tree': {
		node: d.configRows.find((row) => row.name === 'orderSettings.steps')!.setting!.structure
	},
	'reports.component.explorer-ui-explorer-platforms': d.platformHost() as unknown as Record<
		string,
		unknown
	>,
	'reports.component.explorer-ui-explorer-platform-details': {
		host: d.platformHost('web'),
		nav: d.navigation
	},
	'reports.component.explorer-ui-harness-explorer-styles-screen': d.host() as unknown as Record<
		string,
		unknown
	>,
	'reports.component.harness-entity-artifact': {
		cell: d.cell,
		label: 'Assertions',
		mediaBase: '/media/'
	},
	'reports.component.harness-entity-audio': {
		evidence: d.audioEvidence,
		scope: d.shown.scope,
		mediaBase: '/media/'
	},
	'reports.component.harness-entity-behavior': {
		...base,
		behavior: d.behavior,
		read: d.behavior
	},
	'reports.component.harness-entity-behavior-screen': d.host(
		'functions',
		'examples'
	) as unknown as Record<string, unknown>,
	'reports.component.harness-entity-change': {
		row: d.reading.history(d.entity.id)[0],
		timings: [],
		detail: d.changeDetail,
		nav: d.navigation,
		full: true
	},
	'reports.component.harness-entity-config': {
		entity: d.entities.find((e) => e.id === d.ids.settings),
		scope: d.shown.scope,
		nav: d.navigation
	},
	'reports.component.harness-entity-config-screen': d.host('configs') as unknown as Record<
		string,
		unknown
	>,
	'reports.component.harness-entity-details': {
		entity: d.entity,
		contract: d.contract,
		measure: d.measure,
		record: d.shown.head.records[0],
		tab: 'contract',
		commit: d.commits.middle
	},
	'reports.component.harness-entity-details-screen': d.host(
		'components',
		'contract'
	) as unknown as Record<string, unknown>,
	'reports.component.harness-entity-frame': { host: page, children },
	'reports.component.harness-entity-header': { entity: d.entity, nav: d.navigation },
	'reports.component.harness-entity-history-row': {
		row: d.reading.history(d.entity.id)[0],
		detail: undefined,
		timing: undefined,
		viewed: true,
		to: d.navigation.route,
		nav: d.navigation
	},
	'reports.component.harness-entity-history-screen': {
		...d.host(),
		route: { ...d.host().route, section: 'history' }
	},
	'reports.component.harness-entity-history': {
		...entity,
		rows: d.reading.history(d.entity.id),
		index: d.index,
		known: [d.shown.head, d.shown.parent],
		client: d.client
	},
	'reports.component.harness-entity-link': {
		to: d.navigation.route,
		nav: d.navigation,
		children: text('<span>OrderList</span>')
	},
	'reports.component.harness-entity-measures': {
		unit: d.entity.unit,
		record: d.shown.head.records[0]
	},
	'reports.component.harness-entity-missing': {
		nav: d.navigation,
		to: d.navigation.route,
		title: 'Not at this revision',
		message: 'This component was added in a later revision.'
	},
	'reports.component.harness-entity-overview': { entity: d.entity, measure: d.measure, children },
	'reports.component.harness-entity-reasons': { reasons: d.longReasons, open: true },
	'reports.component.harness-entity-relations': {
		...base,
		host: page,
		relations: d.reading.relations(d.entity.id)
	},
	'reports.component.harness-entity-run': seen,
	'reports.component.harness-entity-screens': {
		...base,
		evidence: d.evidence,
		options: d.options,
		reasons: d.reasons
	},
	'reports.component.harness-entity-sections': {
		host: page,
		entity: d.entity,
		nav: d.navigation,
		pane: children
	},
	'reports.component.harness-entity-source': { unit: d.entity.unit, commit: d.commits.middle },
	'reports.component.harness-entity-summary': { measure: d.measure },
	'reports.component.harness-entity-tests': {
		...entity,
		evidence: d.evidence,
		behavior: d.behavior
	},
	'reports.component.harness-entity-visual-screen': page as unknown as Record<string, unknown>,
	'reports.component.harness-explorer-catalog-screen': {
		...page,
		route: { ...page.route, entity: undefined }
	},
	'reports.component.harness-explorer-content': page as unknown as Record<string, unknown>,
	'reports.component.harness-explorer-controls': {
		noun: 'components',
		filter: {
			search: '',
			changedOnly: false,
			order: 'name',
			verification: 'all',
			usage: 'all',
			groups: []
		}
	},
	'reports.component.harness-explorer-frame': { host: page, children },
	'reports.component.harness-explorer-index': {
		category: 'components',
		rows: d.rows,
		list: names
	},
	// The page variant of the card: only it names the provenance of its picture on its link.
	'reports.component.harness-explorer-page-card': {
		row: d.rows[0],
		shot: {
			id: 'preview',
			title: 'Synthetic preview input',
			category: 'Components',
			file: 'synthetic-card-input.svg',
			status: 'not-proven',
			mediaType: 'image',
			standing: 'Synthetic input',
			source: 'fixture-input'
		},
		nav: d.navigation,
		lens: d.reading,
		mediaBase: '/media/',
		category: 'pages'
	},
	'reports.component.harness-explorer-pages-screen': {
		...d.host('pages'),
		route: { ...d.host('pages').route, entity: undefined }
	},
	'reports.component.harness-explorer-table': {
		category: 'configs',
		rows: d.configRows,
		nav: d.navigation,
		lens: d.reading,
		mediaBase: '/media/'
	},
	'reports.component.explorer-ui-explorer-module-card': {
		row: d.rows[0],
		nav: d.navigation,
		lens: d.reading,
		mediaBase: '/media/'
	},
	'reports.component.explorer-catalog-items': { category: 'components', rows: d.rows, ...base },
	'reports.component.explorer-usage': { consumers: d.rows[0].usedIn ?? [], ...base },
	'reports.component.explorer-usage-link': { entity: d.entity, ...base },
	'reports.component.explorer-ui-harness-group': {
		title: 'Orders',
		count: 3,
		children: text('<p>Three modules belong to this group.</p>')
	},
	...sourceCases
};
