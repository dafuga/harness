import type {
	Dimension,
	GameDocument,
	GameState,
	GameInput,
	Checkpoint
} from '../models/Game.types';

export function keyDoor(state: Readonly<GameState>, input: Readonly<GameInput>): GameState {
	const x = Math.max(0, Math.min(10, Math.round((Number(state.x) + input.x) * 100) / 100));
	return {
		...state,
		x: !state.doorOpen && !state.hasKey ? Math.min(x, 3) : x,
		y: Math.max(-3, Math.min(3, Math.round((Number(state.y) + input.y) * 100) / 100)),
		choice: input.choice ?? state.choice
	};
}

export function exampleDocument(dimension: Dimension = '2d'): GameDocument {
	return {
		version: 1,
		mechanics: [
			{
				id: 'movement',
				title: 'Movement and collision',
				description: 'Move independently from the view. Collect the key before passing the door.',
				inputs: ['x', 'y', 'choice'],
				events: ['key-collected', 'door-opened']
			}
		],
		views: [
			{
				id: 'courtyard',
				title: 'The courtyard',
				dimension,
				style:
					'Lush illustrated garden, warm stone, soft sunlight. Preserve the player, key and door positions.',
				checkpoints: starterCheckpoints()
			}
		]
	};
}

function starterCheckpoints(): Checkpoint[] {
	return [
		{
			id: 'key',
			title: 'Collect the key',
			description: 'When the player reaches the key, add it to inventory.',
			x: 0,
			y: 80,
			requires: [],
			conditions: [{ field: 'x', op: 'gte', value: 2 }],
			actions: [
				{ type: 'set', target: 'hasKey', value: true },
				{ type: 'emit', target: 'key-collected', value: true }
			]
		},
		{
			id: 'door',
			title: 'Unlock the door',
			description: 'The key unlocks the door. Reveal two possible destinations.',
			x: 270,
			y: 80,
			requires: ['key'],
			conditions: [
				{ field: 'x', op: 'gte', value: 4 },
				{ field: 'hasKey', op: 'eq', value: true }
			],
			actions: [{ type: 'set', target: 'doorOpen', value: true }]
		},
		branchCheckpoint(
			'garden',
			'Enter the garden',
			'Choosing the garden ends the journey in the sunlight.',
			0
		),
		branchCheckpoint(
			'vault',
			'Explore the vault',
			'Choosing the vault reveals the hidden treasure.',
			180
		)
	];
}

function branchCheckpoint(id: string, title: string, description: string, y: number): Checkpoint {
	return {
		id,
		title,
		description,
		x: 540,
		y,
		requires: ['door'],
		conditions: [
			{ field: 'choice', op: 'eq', value: id },
			{ field: 'outcome', op: 'eq', value: '' }
		],
		actions: [{ type: 'set', target: 'outcome', value: id }]
	};
}
