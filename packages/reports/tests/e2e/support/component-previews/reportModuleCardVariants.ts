import type { PreviewCases } from './shared';
import { picture } from './reportData';
import { entities, entity, helperRows, reading } from './explorerData';
import { entityCatalog } from '../../../../src/utils/entityCatalog';

/** Distinct visual, page and nonvisual rows of the shared module card. */
export function moduleCardVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'missing') return { ...props, shot: null };
	if (variant === 'function') return { ...props, row: helperRows[0] };
	if (variant === 'page' || variant === 'page-missing') {
		const row = entityCatalog(entities, 'pages', reading.relations)[0];
		const shot =
			variant === 'page' ? { ...picture, file: 'synthetic-orders-page-input.svg' } : null;
		return { ...props, row, category: 'pages', shot };
	}
	if (variant === 'unlinked') {
		const unit = { ...entity.unit, id: 'app.style.orders', kind: 'style', title: 'Orders styles' };
		const support = { id: unit.id, role: 'Style sheet', name: unit.title, unit };
		return {
			...props,
			row: { support, id: unit.id, name: unit.title, usedIn: [entity], opens: null }
		};
	}
	return null;
}
