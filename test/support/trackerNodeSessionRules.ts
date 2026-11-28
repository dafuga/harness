import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { expect } from 'vitest';
import { fixtureTrackerJson } from './trackerNodeProcess';
import type { TrackerNodeFixture } from './trackerNodeProcess.types';

export async function verifySessionRuleSync(
	hub: TrackerNodeFixture,
	spoke: TrackerNodeFixture,
	incident: string
) {
	const skill = 'computer-hygiene';
	const hubText = 'Close synthetic browser windows after checking the fixture.';
	const spokeText = 'Keep fixture output within the working directory.';
	for (const [author, reader, text] of [
		[hub, spoke, hubText],
		[spoke, hub, spokeText]
	] as const) {
		const rule = await fixtureTrackerJson(author, [
			'rule',
			'add',
			text,
			'--from',
			incident,
			'--skill',
			skill
		]);
		await expect
			.poll(() => fixtureTrackerJson(reader, ['rule', 'list', '--skill', skill]), {
				timeout: 8_000
			})
			.toContainEqual(rule);
		await expect
			.poll(() => fixtureTrackerJson(reader, ['show', incident]), { timeout: 8_000 })
			.toMatchObject({
				notes_log: expect.arrayContaining([
					expect.objectContaining({ text: `Session rule (${skill}): ${text}` })
				])
			});
	}
}

export async function setFixtureSessionRule(runtime: TrackerNativeRuntimeService, from: string) {
	const text = 'Read only the last fifty lines of a synthetic fixture log.';
	const response = await runtime.items.handle(
		new Request('http://localhost/rules', {
			method: 'POST',
			body: JSON.stringify({ from, skill: 'computer-hygiene', text })
		})
	);
	expect(response.status).toBe(201);
	return text;
}
