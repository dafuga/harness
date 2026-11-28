// @harness-uid u_mzhddyflf2
import type { TrackerSessionRule } from '../TrackerSessionRuleRepository.types';

export const trackerSessionRuleSeeds = [
	{
		at: '2026-11-28T11:50:42.133Z',
		incident: 'vj5xv5ks8s',
		skill: 'secret-safe-computer-use',
		text: 'Never hunt for credentials on disk. Use the approved credential store or broker for the known project and environment. If the credential is unavailable, record the blocker. Never search across project trees for secret files.'
	},
	{
		at: '2026-11-28T10:12:35.142Z',
		incident: 'z7paezpywr',
		skill: 'computer-hygiene',
		text: 'Close tabs and windows the session opened, including app-opened OAuth authorization and callback tabs, when finished with them. Preserve pre-existing tabs, windows and sign-ins.'
	},
	{
		at: '2026-11-28T11:16:04.985Z',
		incident: 'f08g9953x4',
		skill: 'computer-hygiene',
		text: 'Keep context small. Inspect logs with a bounded tail or targeted search, and never dump a whole log into the session.'
	},
	{
		at: '2026-11-28T11:50:42.133Z',
		incident: 'vj5xv5ks8s',
		skill: 'computer-hygiene',
		text: 'Keep local LLM weights unloaded on daniel-primary-mbp during tests. Use the approved test host for local model runs.'
	},
	{
		at: '2026-11-28T11:46:00.228Z',
		incident: 'q6cpy13v22',
		skill: 'computer-hygiene',
		text: 'Use the CLI when it supports the required operation. Use Chrome for work that requires the browser.'
	}
] satisfies readonly TrackerSessionRule[];
