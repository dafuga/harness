import type { DatabaseSync } from 'node:sqlite';
import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';

export interface TrackerSlotPane {
	id: string;
	created: number;
	activity: number;
	screen: string;
}

export interface TrackerSlotFixture {
	runtime: TrackerNativeRuntimeService;
	database: DatabaseSync;
	request(path: string, body?: object): Promise<void>;
	panes(): string[];
	allPanes(): string[];
	screen(name: string, screen: string): void;
	advance(milliseconds: number): Promise<void>;
	runs(itemId: string): object[];
	item(itemId: string): { status: string; auto: string };
	queue(itemId: string): void;
}
