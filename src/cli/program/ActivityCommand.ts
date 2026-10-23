import type { Flags } from './ActivityCommand.types';
import type { Command } from 'commander';
import {
	beatAgent,
	finishAgent,
	listAgents,
	registerAgent,
	renderRoster,
	renderShown,
	showActivity
} from '../../workflows/projects-sessions/runActivity';

function print(flags: Flags, value: unknown, text: string): void {
	console.log(flags.json ? JSON.stringify(value, null, 2) : text);
}

/** What an agent may restate with every heartbeat. */
function stated(command: Command): Command {
	return command
		.option('--task <text>', 'What the agent is working on, in one line.')
		.option('--loop <name>', 'The Harness loop the work belongs to.')
		.option('--units <ids>', 'Unit ids the agent is assigned, separated by commas.')
		.option('--json', 'Print structured results.');
}

export function registerActivityCommand(program: Command): Command {
	const activity = program
		.command('activity')
		.description('What this repository is doing: recent work, checkouts and registered agents.');
	activity
		.command('show')
		.option('--limit <n>', 'Newest commits to show.', '20')
		.option('--json', 'Print structured results.')
		.description('Show loop types, recent commits, changed files, checkouts and working agents.')
		.action(async (flags: Flags) => {
			const shown = await showActivity(flags);
			print(flags, shown, renderShown(shown));
		});
	stated(activity.command('register'))
		.option('--label <text>', 'Who the agent is, as its owner names it.')
		.option('--id <id>', 'An id to register under; one is made otherwise.')
		.option('--provider <name>', 'The provider, only when the owner knows it.')
		.option('--model <name>', 'The model, only when the owner knows it.')
		.option('--pid <pid>', 'A process that lives as long as the agent does.')
		.option('--ttl <seconds>', 'Seconds allowed between heartbeats.', '900')
		.description('Register an agent that is working in this checkout.')
		.action(async (flags: Flags) => {
			const made = await registerAgent(flags);
			print(flags, made, `Registered ${made.id}; send a heartbeat within ${made.ttlSeconds} s.`);
		});
	stated(activity.command('heartbeat <id>'))
		.description('Say that a registered agent is still working, and on what.')
		.action(async (id: string, flags: Flags) => {
			print(flags, await beatAgent(id, flags), `Heartbeat of ${id} recorded.`);
		});
	activity
		.command('finish <id>')
		.option('--failed', 'The work ended without succeeding.')
		.option('--outcome <text>', 'How it ended, in one line.')
		.option('--json', 'Print structured results.')
		.description('Say that a registered agent has ended its work.')
		.action(async (id: string, flags: Flags) => {
			const ended = await finishAgent(id, flags);
			print(flags, ended, `${id} is recorded as ${ended.status}.`);
		});
	activity
		.command('agents')
		.option('--json', 'Print structured results.')
		.description('List the agents registered in the checkouts of this repository.')
		.action(async (flags: Flags) => {
			const roster = await listAgents();
			print(flags, roster, renderRoster(roster));
		});
	return activity;
}
