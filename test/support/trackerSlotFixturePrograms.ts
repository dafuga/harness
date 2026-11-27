const shared = `
const fs = require('node:fs');
const path = require('node:path');
const state = path.join(__dirname, 'panes.json');
const panes = JSON.parse(fs.readFileSync(state, 'utf8'));
`;

export const tmuxProgram = `${shared}
const [,,, socket, command, ...args] = process.argv;
if (socket !== 'default') process.exit(2);
const line = (name) => { const pane = panes[name];
	return [name, pane.created, 71, pane.id, 200, Math.floor(pane.activity), pane.x ?? 2, 1, 0, 0, 0,\n\t\tpane.attached ? 1 : 0, 1, 1, 'claude'].join('|'); };
const byId = (id) => Object.keys(panes).find((name) => panes[name].id === id);
const target = args[args.indexOf('-t') + 1];
if (command === 'list-panes') process.stdout.write(Object.keys(panes).map(line).join('\\n') + '\\n');
else if (command === 'capture-pane') process.stdout.write(panes[byId(target)].screen);
else if (command === 'display-message')
	process.stdout.write((args.at(-1).includes('session_name') ? line(byId(target)) : __dirname) + '\\n');
else if (command === 'if-shell' && args.join(' ').includes('kill-session')) {
	if (panes[byId(target)].unkillable) process.exit(0);
	delete panes[byId(target)];
	fs.writeFileSync(state, JSON.stringify(panes));
	process.stdout.write('tracker-session-closed\\n');
} else if (command === 'if-shell' &&
	(panes[byId(target)]?.x === 3 || args.at(-1).includes('Tracker answer for item '))) {
	const pane = panes[byId(target)];
	const keys = args.at(-1);
	fs.appendFileSync(path.join(__dirname, 'input.log'), keys + '\\n');
	if (keys.includes('Tracker answer for item ')) {
		const draft = keys.split(' -l ')[1].split("' ;")[0].slice(1);
		if (!keys.includes(' Enter')) {
			pane.screen = pane.screen.replace('❯ ', '❯ ' + draft);
			pane.x = 3;
		}
	}
	if (keys.includes(' Enter')) {
		pane.screen = pane.x === 3 ? pane.screen.replace(/^❯ .*$/m, '❯ ') : 'Working (esc to interrupt)';
		pane.x = 2;
	}
	fs.writeFileSync(state, JSON.stringify(panes));
	process.stdout.write('tracker-watchdog-sent\\n');
} else if (command === 'if-shell' || command === 'send-keys')
	fs.appendFileSync(path.join(__dirname, 'input.log'), args.join(' ') + '\\n');
else process.exit(2);
`;

export const driverProgram = `${shared}
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const ledger = path.join(__dirname, 'sessions.json');
const sessions = fs.existsSync(ledger) ? JSON.parse(fs.readFileSync(ledger, 'utf8')) : [];
if (process.argv[2] === 'start') {
	const { itemId, key, queuedAt, runId } = input;
	const tmux = 'auto-' + itemId.slice(0, 6) + '-r' + runId;
	const session = { itemId, key, id: 'synthetic-' + runId, tmux, state: 'live', startedAt: queuedAt };
	fs.writeFileSync(ledger, JSON.stringify([...sessions, session]));
	panes[tmux] = { id: '%' + runId, created: Math.floor(queuedAt / 1000), activity: queuedAt / 1000,
		screen: 'Working (esc to interrupt)' };
	fs.writeFileSync(state, JSON.stringify(panes));
	process.stdout.write(JSON.stringify({ status: 'started', session }));
} else if (process.argv[2] === 'inspect')
	process.stdout.write(JSON.stringify(sessions.filter(({ tmux }) => panes[tmux]).map((session) => {
		const { exit } = panes[session.tmux];
		return exit === undefined ? session : { ...session, state: 'exited', exitCode: exit };
	})));
else process.stdout.write('true');
`;
