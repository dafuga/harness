import type { EntityLens } from '../../../../src/utils/entityLens';
import { entityCatalog } from '../../../../src/utils/entityCatalog';
import { configRows, entities, entity, helperRows, ids, reading, rows } from './explorerData';
import { orderListImage } from './reportEntityStatesVariants';
import { image, ordersPageImage, type PreviewCases } from './shared';

/** Synthetic input images name the actual consumer represented by each catalog row. */
function picture(id: string) {
	if (id === ids.card) return image;
	if (id === ids.list) return orderListImage(false);
	if (id === ids.page) return 'data:image/svg+xml,' + encodeURIComponent(ordersPageImage);
	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560"><rect width="920" height="560" fill="#0e1c29"/><text x="52" y="60" fill="#f3c33b" font-family="sans-serif" font-size="20">SYNTHETIC SEARCH BOX</text><text x="52" y="130" fill="#f4f7fb" font-family="sans-serif" font-size="36">Search orders</text><rect x="52" y="175" width="680" height="64" rx="8" fill="#142b3e" stroke="#92a6bb"/><text x="72" y="218" fill="#d8e4ee" font-family="sans-serif" font-size="24">Find an order</text></svg>';
	return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** Rows, config values and pagination stay on the real catalog component. */
export function catalogItemsVariant(props: PreviewCases[string], variant: string) {
	const lens = props.lens as EntityLens;
	const illustrated: EntityLens = {
		...lens,
		evidence: (unit) => {
			const evidence = lens.evidence(unit);
			const captures = evidence.after.captures.map((found) => ({
				...found,
				capture: { ...found.capture, media: picture(unit.id) }
			}));
			return { ...evidence, after: { ...evidence.after, captures } };
		}
	};
	const base = { ...props, lens: illustrated, mediaBase: '' };
	if (variant === 'multiple') return { ...base, rows };
	if (['batched', 'more', 'all', 'batch-focused', 'batch-hovered'].includes(variant))
		return { ...base, rows, batch: 1, label: 'Components' };
	if (variant === 'functions') return { ...base, category: 'functions', rows: helperRows };
	if (variant === 'pages')
		return {
			...base,
			category: 'pages',
			rows: entityCatalog(entities, 'pages', reading.relations)
		};
	if (variant === 'empty-configs') return { ...base, category: 'configs', rows: [] };
	if (variant === 'configs' || variant === 'configs-open') {
		const selected = [
			'orderSettings.enabled',
			'orderSettings.pageSize',
			'orderSettings.regions',
			'orderSettings.steps'
		];
		return {
			...base,
			category: 'configs',
			rows: configRows.filter((row) => selected.includes(row.name))
		};
	}
	if (variant === 'unlinked') {
		const unit = { ...entity.unit, id: 'app.style.orders', kind: 'style', title: 'Orders styles' };
		const support = { id: unit.id, role: 'Style sheet', name: unit.title, unit };
		return {
			...base,
			category: null,
			rows: [{ support, id: unit.id, name: unit.title, usedIn: [entity], opens: null }]
		};
	}
	return null;
}
