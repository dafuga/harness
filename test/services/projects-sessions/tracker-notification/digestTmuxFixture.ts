/** A fake tmux with one Claude composer; the `mode` file makes it busy or idle. */
export const digestTmuxFixture = `
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const args = process.argv.slice(2);
const dir = dirname(process.argv[1]);
const sent = join(dir, 'sent');
const raw = 'cos|1800000000|71|%9|200|1800000000|2|2|0|0|0|0|1|1|claude';
const rule = '─'.repeat(20);
const busy = readFileSync(join(dir, 'mode'), 'utf8') === 'busy';
switch (args[2]) {
	case 'list-panes': case 'display-message': process.stdout.write(raw + '\\n'); break;
	case 'capture-pane':
		if (existsSync(sent)) process.stdout.write('fixture\\n✻ Working (esc to interrupt)\\n');
		else if (existsSync(join(dir, 'keys.json'))) process.stdout.write('fixture\\n' + rule + '\\n❯ typed digest\\n' + rule + '\\n? for shortcuts\\n');
		else if (busy) process.stdout.write('✻ Working (esc to interrupt)\\n' + rule + '\\n❯ \\n' + rule + '\\n? for shortcuts\\n');
		else process.stdout.write('fixture\\n' + rule + '\\n❯ \\n' + rule + '\\n? for shortcuts\\n');
		break;
	case 'if-shell':
		// The message is typed first; only the later Enter submits it.
		if (args.at(-1).includes(' -l ')) writeFileSync(join(dir, 'keys.json'), JSON.stringify(args));
		else writeFileSync(sent, '1');
		process.stdout.write('tracker-watchdog-sent\\n');
		break;
	default: process.exit(2);
}
`;
