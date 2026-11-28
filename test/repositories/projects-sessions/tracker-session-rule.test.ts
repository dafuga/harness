import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import {
	TrackerSessionRuleRepository,
	trackerRuleFields
} from '../../../src/repositories/projects-sessions/TrackerSessionRuleRepository';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { measureWorkload } from '../../support/measureWorkload';

test('projects new and replicated revisions while preserving one copy of a retried rule', () =>
	measureWorkload(
		'repository.projects-sessions-tracker-session-rule',
		'replicated-session-rules',
		() => {
			const hubDatabase = new DatabaseSync(':memory:');
			const spokeDatabase = new DatabaseSync(':memory:');
			try {
				const now = () => Date.parse('2026-11-29T12:00:00.000Z');
				const hub = new TrackerPersistenceService(hubDatabase, 'fixture-hub', { now });
				const spoke = new TrackerPersistenceService(spokeDatabase, 'fixture-spoke', { now });
				const read = new TrackerSessionRuleRepository(spokeDatabase);
				const skill = 'computer-hygiene';
				const text = 'Close the test fixture after use.';
				const fields = trackerRuleFields({ skill, text });
				const first = hub.appendLocal({ itemId: 'fixture123', fields });
				const duplicate = spoke.appendLocal({ itemId: 'fixture123', fields });
				expect(hub.applyOps([duplicate])).toBe(1);
				expect(spoke.applyOps([first, first])).toBe(1);
				const hubRules = new TrackerSessionRuleRepository(hubDatabase).list(skill);
				expect(read.list(skill)).toEqual(hubRules);
				expect(hubRules.filter((rule) => rule.text === text)).toEqual([
					{ at: '2026-11-29T12:00:00.000Z', incident: 'fixture123', skill, text }
				]);
				expect(read.list('unused-skill')).toEqual([]);
			} finally {
				spokeDatabase.close();
				hubDatabase.close();
			}
		}
	));
