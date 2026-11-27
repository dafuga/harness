import { codexComposer, composer } from './trackerSlotFixture';
import type { TrackerSlotProvider } from './trackerSlotFixture.types';

/** The two launcher providers, as their composers appear on screen. */
export const slotProviders: TrackerSlotProvider[] = [
	{
		cli: 'claude',
		model: 'claude-sonnet-5-5:high',
		idle: composer(),
		background: composer('  ⏵⏵ bypass permissions on · 1 shell · ↓ to manage')
	},
	{
		cli: 'codex',
		model: 'gpt-6.2-sol:high',
		idle: codexComposer(),
		background: codexComposer('  1 background terminal running · /ps to view')
	}
];
