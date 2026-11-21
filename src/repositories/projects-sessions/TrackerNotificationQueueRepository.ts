// @harness-uid u_e7x5dhawh4
import { SqliteAdapter } from '../../adapters/development-tooling/SqliteAdapter';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type {
	TrackerNotificationQueue,
	TrackerNotificationState
} from '../../services/projects-sessions/TrackerNotificationService.types';
import type { TrackerNotificationQueueOptions } from './TrackerNotificationQueueRepository.types';
import {
	initializeQueueSchema,
	validateQueueTable
} from './tracker-notification-queue-repository/legacyQueueSchema';
import {
	attentionItemsTable,
	attentionTable,
	callbackTable,
	flagTable,
	outboxTable,
	reminderTable
} from './tracker-notification-queue-repository/legacyQueueTables';
import { notificationExclusivity } from './tracker-notification-queue-repository/queueExclusivity';
import {
	readQueueMetadata,
	writeQueueMetadata
} from './tracker-notification-queue-repository/queueMetadata';
import {
	readQueueTable,
	validateTable,
	writeQueueTable
} from './tracker-notification-queue-repository/queueTable';

/** Shares the legacy Tracker queue tables and adds a durable slot for an unacknowledged send. */
export class TrackerNotificationQueueRepository implements TrackerNotificationQueue {
	readonly exclusive: TrackerNotificationQueue['exclusive'];
	private readonly storage: SqliteAdapter;
	private readonly callbacks: ReturnType<typeof callbackTable>;

	constructor(
		private readonly database: SqliteDatabase,
		private readonly options: TrackerNotificationQueueOptions
	) {
		this.storage = new SqliteAdapter(database, []);
		this.callbacks = callbackTable(options.resolveDestination);
		this.exclusive = notificationExclusivity(database);
		this.storage.transaction(() => {
			initializeQueueSchema(database);
			validateTable(database, this.callbacks);
			validateTable(database, reminderTable);
			validateTable(database, outboxTable);
			validateTable(database, flagTable);
			validateTable(database, attentionTable);
			validateTable(database, attentionItemsTable);
			validateQueueTable(database, 'meta', 'k', ['v']);
			validateQueueTable(database, 'harness_notification_inflight', 'slot', ['attempt']);
		});
	}

	update<T>(change: (state: TrackerNotificationState) => T): T {
		return this.storage.transaction(() => {
			const before = this.read();
			const draft = globalThis.structuredClone(before);
			const result = change(draft);
			this.write(before, draft);
			return result;
		});
	}

	private read(): TrackerNotificationState {
		const db = this.database;
		return {
			callbacks: readQueueTable(db, this.callbacks),
			reminders: readQueueTable(db, reminderTable),
			flags: readQueueTable(db, flagTable),
			outbox: readQueueTable(db, outboxTable),
			attention: readQueueTable(db, attentionTable),
			attentionItems: readQueueTable(db, attentionItemsTable),
			...readQueueMetadata(db)
		};
	}

	private write(before: TrackerNotificationState, after: TrackerNotificationState): void {
		const db = this.database;
		writeQueueTable(db, this.callbacks, before.callbacks, after.callbacks);
		writeQueueTable(db, reminderTable, before.reminders, after.reminders);
		writeQueueTable(db, flagTable, before.flags, after.flags);
		writeQueueTable(db, outboxTable, before.outbox, after.outbox);
		writeQueueTable(db, attentionTable, before.attention, after.attention);
		writeQueueTable(db, attentionItemsTable, before.attentionItems, after.attentionItems);
		writeQueueMetadata(db, before, after, this.options.now ?? Date.now);
	}
}

export type { TrackerNotificationQueueOptions } from './TrackerNotificationQueueRepository.types';
