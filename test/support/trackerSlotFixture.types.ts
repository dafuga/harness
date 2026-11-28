import type { DatabaseSync } from 'node:sqlite';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';

export interface TrackerSlotPane {
	id: string;
	created: number;
	activity: number;
	screen: string;
	attached?: boolean;
	/** The closer's kill has no effect, as when a pane outlives the launcher's sweep. */
	unkillable?: boolean;
	/** The provider process exited while its tmux session stayed. */
	exit?: number;
}

export interface TrackerSlotFixture {
	runtime: TrackerNativeRuntimeService;
	database: DatabaseSync;
	request(path: string, body?: object, actor?: string): Promise<void>;
	panes(): string[];
	allPanes(): string[];
	screen(name: string, screen: string): void;
	change(name: string, fields: Partial<TrackerSlotPane>): void;
	now(): number;
	tmuxInput(): string;
	tmux: string;
	advance(milliseconds: number): Promise<void>;
	runs(itemId: string): object[];
	item(itemId: string): { status: string; auto: string };
	queue(itemId: string, model?: string): void;
}

export interface TrackerSlotProvider {
	cli: string;
	model: string;
	idle: string;
	background: string;
}
