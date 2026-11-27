// @harness-uid u_w7rfpwiwmn
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { openHygieneBrowser } from './tracker-hygiene-command/hygieneBrowser';
import { openHygieneContainer } from './tracker-hygiene-command/hygieneContainer';
import { openHygieneProcess, holdHygieneProcess } from './tracker-hygiene-command/hygieneProcess';
import { openHygieneSimulator } from './tracker-hygiene-command/hygieneSimulator';
import { hygieneDirectory, markResource } from './tracker-hygiene-command/hygieneLedger';
import { hygieneSkills, installHygieneSkills } from './tracker-hygiene-command/hygieneSkills';
import { startHygieneWatch, watchHygiene } from './tracker-hygiene-command/hygieneWatch';
import { sweepResource } from './tracker-hygiene-command/hygieneCleanup';
import { waitForHygiene } from './tracker-hygiene-command/hygieneChild';

const usage = `Usage: harness hygiene <skills [computer-hygiene|design-patterns] | install-skills |
  tab [URL] | window [URL] | simulator SOURCE-UDID | container IMAGE-ID [COMMAND...] |
  process -- EXECUTABLE [ARGS...] | close RESOURCE-ID>`;

export class TrackerHygieneCommand {
	async run(args: string[]): Promise<number> {
		const [action, ...values] = args;
		try {
			if (action === 'install-skills') installHygieneSkills();
			else if (action === 'skills') showSkills(values[0]);
			else if (action?.startsWith('_')) await supervise(action, values);
			else if (!action || action === '--help' || action === '-h') console.log(usage);
			else {
				const result = await manageResource(action, values);
				if (result) console.log(JSON.stringify(result));
			}
			return 0;
		} catch {
			console.error(
				'Computer hygiene could not complete ' +
					(action?.startsWith('_') ? 'run supervision' : 'the requested action') +
					'. Check the run ledger and command usage.'
			);
			return 1;
		}
	}
}

function showSkills(name?: string) {
	if (!name) console.log(Object.keys(hygieneSkills).join('\n'));
	else
		process.stdout.write(
			hygieneSkills[z.enum(['computer-hygiene', 'design-patterns']).parse(name)]
		);
}

async function manageResource(action: string, args: string[]) {
	const values = args[0] === '--' ? args.slice(1) : args;
	switch (action) {
		case 'tab':
		case 'window':
			return openHygieneBrowser(action, values[0]);
		case 'simulator':
			return openHygieneSimulator(values[0]);
		case 'container':
			return openHygieneContainer(values);
		case 'process':
			return openHygieneProcess(values);
		case 'close': {
			const resource = z.string().uuid().parse(values[0]);
			const entry = join(hygieneDirectory(), resource);
			if (!existsSync(entry) || (await sweepResource(entry)))
				throw new Error('Resource closure was not confirmed.');
			return { closed: resource };
		}
		default:
			throw new Error(usage);
	}
}

async function supervise(action: string, [id, start, limit]: string[]) {
	const directory = hygieneDirectory();
	switch (action) {
		case '_start':
			installHygieneSkills();
			return startHygieneWatch(directory, Number(id), Number(start));
		case '_watch':
			return watchHygiene(directory, Number(id), start, Number(limit));
		case '_process':
			if (join(directory, z.string().uuid().parse(id.split('/').pop())) !== id)
				throw new Error('Invalid run resource.');
			return holdHygieneProcess(
				id,
				z
					.array(z.string())
					.min(1)
					.parse(JSON.parse(await Bun.stdin.text()))
			);
		case '_finish':
			markResource(directory, 'closing');
			await waitForHygiene(() => existsSync(join(directory, 'cleanup.json')), 3000);
			return;
		default:
			throw new Error('Unknown resource supervisor action.');
	}
}
