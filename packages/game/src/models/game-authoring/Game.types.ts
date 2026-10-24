export type Dimension = '2d' | '3d';
export type Value = string | number | boolean;
export type GameState = Record<string, Value>;
export interface Condition {
	field: string;
	op: 'eq' | 'gte' | 'lte';
	value: Value;
}
export interface GameAction {
	type: 'set' | 'emit' | 'transition' | 'visibility';
	target: string;
	value: Value;
}
export interface CheckpointImage {
	path: string;
	model: 'gpt-image-2';
	prompt: string;
	createdAt: string;
}
export interface Checkpoint {
	imagePrompt?: string;
	image?: CheckpointImage;
	id: string;
	title: string;
	description: string;
	x: number;
	y: number;
	requires: string[];
	conditions: Condition[];
	actions: GameAction[];
	repeatable?: boolean;
}
export interface GameView {
	id: string;
	title: string;
	dimension: Dimension;
	style: string;
	checkpoints: Checkpoint[];
	planning?: LevelPlanning;
	world?: LevelLayout;
}
export interface MechanicDefinition {
	id: string;
	title: string;
	description: string;
	inputs: string[];
	events: string[];
}
export interface GameDocument {
	version: 1;
	views: GameView[];
	mechanics: MechanicDefinition[];
}
export interface GameInput {
	x: number;
	y: number;
	interact?: boolean;
	choice?: string;
}
export interface TraceEntry {
	viewId?: string;
	tick: number;
	checkpointId: string;
	reason: string;
}
export interface GameRun {
	viewId?: string;
	progress?: Record<string, string[]>;
	tick: number;
	seed: number;
	state: GameState;
	completed: string[];
	events: string[];
	trace: TraceEntry[];
}
export interface Mechanic {
	id: string;
	step: (state: Readonly<GameState>, input: Readonly<GameInput>) => GameState;
}
export interface FrameSource {
	canvas: HTMLCanvasElement;
	render(run: GameRun, view: GameView): void;
	dispose(): void;
}
export interface RenderSessionRequest {
	projectId: string;
	model: 'lucy-restyle-2' | 'lucy-2.5';
	fast: boolean;
	seconds: number;
}
export interface RenderSession {
	apiKey: string;
	expiresAt: string;
	model: RenderSessionRequest['model'];
	fast: boolean;
	seconds: number;
	rate: number;
}
export interface GameBridge {
	read(input: {
		projectId: string;
		commit?: string;
	}): Promise<{ document: GameDocument; revision: string }>;
	save(input: {
		projectId: string;
		document: GameDocument;
		expectedRevision: string;
	}): Promise<{ revision: string }>;
	startRender(input: RenderSessionRequest): Promise<RenderSession>;
}

export interface LevelObject {
	id: string;
	kind: 'wall' | 'platform' | 'prop' | 'goal';
	label: string;
	x: number;
	z: number;
	width: number;
	depth: number;
	height: number;
}
export interface LevelLayout {
	width: number;
	depth: number;
	spawn: { x: number; z: number };
	objects: LevelObject[];
}
export interface LevelProposal {
	id: string;
	concept: string;
	description: string;
	dimension: Dimension;
	provider: 'codex' | 'claude';
	model: string;
	summary: string;
	layout: LevelLayout;
}
export interface LevelPlanning {
	concept: string;
	description: string;
	proposal?: LevelProposal;
	approved?: string;
	built?: string;
}
