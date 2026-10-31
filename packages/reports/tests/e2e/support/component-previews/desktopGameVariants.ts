import { exampleDocument } from '../../../../../game/src/index';
import type {
	Checkpoint,
	GameView
} from '../../../../../game/src/models/game-authoring/Game.types';
import type { PreviewProps } from './shared.types';
import { noop } from './shared';

export const desktopGameCatalogVariants: Record<string, string[]> = {
	'desktop.component.game-checkpoint-editor': ['empty', 'readonly', 'empty-rules', 'long'],
	'desktop.component.game-checkpoint-pane': ['adding', 'readonly', 'advanced', 'long'],
	'desktop.component.game-create': ['filled', 'game-2d', 'game-3d', 'unavailable', 'busy', 'error'],
	'desktop.component.game-level-brief': [
		'concept',
		'empty',
		'readonly',
		'busy',
		'error',
		'reviewable',
		'no-model',
		'long'
	],
	'desktop.component.game-preview': ['three-dimensional', 'readonly', 'reset'],
	'desktop.component.game-view-fields': ['settings-open', 'readonly', 'gated', 'multiple']
};

/** Game authoring fixtures use public component inputs and synthetic bridge responses only. */
export function desktopGameVariant(id: string, props: PreviewProps, variant: string) {
	const name = id.replace('desktop.component.', '');
	if (name === 'game-create') return creation(props, variant);
	if (name === 'game-level-brief') return brief(props, variant);
	if (name === 'game-checkpoint-editor') return checkpoint(props, variant);
	if (name === 'game-checkpoint-pane') return pane(props, variant);
	if (name === 'game-view-fields') return fields(props, variant);
	if (name !== 'game-preview') return null;
	if (variant === 'three-dimensional') return { ...props, view: exampleDocument('3d').views[0] };
	return { ...props, readonly: variant === 'readonly' };
}
function creation(props: PreviewProps, variant: string): PreviewProps {
	if (variant === 'unavailable') return { ...props, bridge: {} };
	if (variant === 'busy') return { ...props, bridge: { gameCreate: () => new Promise(() => {}) } };
	return props;
}
function brief(props: PreviewProps, variant: string): PreviewProps {
	const planning = props.planning as { concept: string; description: string };
	const status = { busy: false, readonly: false, reason: '', error: '' };
	const changes: Record<string, PreviewProps> = {
		concept: { step: 'concept' },
		empty: { step: 'concept', planning: { concept: '', description: '' } },
		readonly: { status: { ...status, readonly: true } },
		busy: { status: { ...status, busy: true } },
		error: { status: { ...status, error: 'Synthetic provider refused the proposal.' } },
		reviewable: { reviewable: true },
		'no-model': {
			providers: [],
			provider: '',
			model: '',
			status: { ...status, reason: 'No local model is available.' }
		},
		long: {
			planning: { concept: planning.concept.repeat(8), description: planning.description.repeat(8) }
		}
	};
	return { ...props, ...changes[variant] };
}
function checkpoint(props: PreviewProps, variant: string): PreviewProps {
	const node = props.checkpoint as Checkpoint;
	const changes: Record<string, PreviewProps> = {
		empty: { checkpoint: null },
		readonly: { readonly: true },
		'empty-rules': { checkpoint: { ...node, conditions: [], actions: [] } },
		long: {
			checkpoint: {
				...node,
				repeatable: true,
				requires: ['first-checkpoint', 'second-checkpoint', 'third-checkpoint'],
				conditions: [{ field: 'inventory.special-key.collected', op: 'eq', value: true }],
				actions: [
					{
						type: 'emit',
						target: 'quest.progress.updated',
						value: 'A longer event payload retained by the checkpoint.'
					}
				]
			}
		}
	};
	return { ...props, ...changes[variant] };
}
function pane(props: PreviewProps, variant: string): PreviewProps {
	const context = props.context as { checkpoint: Checkpoint; view: GameView };
	return {
		...props,
		close: noop,
		remove: noop,
		adding: variant === 'adding',
		readonly: variant === 'readonly',
		...(variant === 'long'
			? {
					context: {
						...context,
						checkpoint: {
							...context.checkpoint,
							title: 'A checkpoint with a long title',
							description: 'A detailed description of the checkpoint and its outcome. '.repeat(8)
						}
					}
				}
			: {})
	};
}
function fields(props: PreviewProps, variant: string): PreviewProps {
	const view = props.view as GameView;
	const changes: Record<string, PreviewProps> = {
		readonly: { readonly: true },
		gated: {
			view: {
				...view,
				planning: { concept: 'Unbuilt level', description: 'Awaiting approval and build.' }
			},
			section: 'Level'
		},
		multiple: {
			views: [view, { ...view, id: 'second-level', title: 'A second level with a longer title' }]
		}
	};
	return { ...props, ...changes[variant] };
}
