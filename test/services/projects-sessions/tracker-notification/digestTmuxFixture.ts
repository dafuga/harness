/** A fake tmux with one Claude composer; the `mode` file makes it busy or idle. */
export const digestTmuxFixture = `
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const args = process.argv.slice(2);
const dir = dirname(process.argv[1]);
const sent = join(dir, 'sent');
const typed = join(dir, 'typed');
const draft = existsSync(typed) && !existsSync(sent);
const raw = 'cos|1800000000|71|%9|200|1800000000|' + (draft ? 20 : 2) + '|2|0|0|0|0|1|1|claude';
const rule = '─'.repeat(20);
const busy = readFileSync(join(dir, 'mode'), 'utf8') === 'busy';
switch (args[2]) {
	case 'list-panes': case 'display-message': process.stdout.write(raw + '\\n'); break;
	case 'capture-pane':
		if (existsSync(sent)) process.stdout.write('fixture\\n✻ Working (esc to interrupt)\\n');
		else if (busy) process.stdout.write('✻ Working (esc to interrupt)\\n' + rule + '\\n❯ \\n' + rule + '\\n? for shortcuts\\n');
		else if (draft) process.stdout.write('fixture\\n' + rule + '\\n❯ [Pasted text #1]\\n' + rule + '\\npaste again to expand\\n');
		else process.stdout.write('fixture\\n' + rule + '\\n❯ \\n' + rule + '\\n? for shortcuts\\n');
		break;
	case 'if-shell':
		if (args.at(-1).includes(' -l ')) {
			writeFileSync(join(dir, 'keys.json'), JSON.stringify(args));
			writeFileSync(typed, '1');
		} else writeFileSync(sent, '1');
		process.stdout.write('tracker-watchdog-sent\\n');
		break;
	default: process.exit(2);
}
`;
