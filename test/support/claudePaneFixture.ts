/**
 * A fake tmux with one Claude composer, modelled on Claude Code 2.1.332: text and Enter read together
 * stay an unsent paste; a separate Enter submits. The `mode` file selects the failure under test.
 */
export const claudePaneFixture = `
const { appendFileSync, existsSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const args = process.argv.slice(2);
const dir = dirname(process.argv[1]);
const read = (name, fallback) =>
	existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : fallback;
const mode = read('mode', 'idle');
const state = JSON.parse(read('state', '{"draft":"","enters":0,"submitted":false}'));
const save = () => writeFileSync(join(dir, 'state'), JSON.stringify(state));
const rule = '─'.repeat(20);
const x = state.draft ? 20 : 2;
const raw = 'cos|1800000000|71|%9|200|1800000000|' + x + '|2|0|0|0|0|1|1|claude';
function screen() {
	if (mode === 'busy') return ['✻ Working (esc to interrupt)', rule, '❯ ', rule, '? for shortcuts'];
	if (state.scrolled) return ['─── ↑ 1 more ───', state.draft, rule, '  paste again to expand'];
	const footer = state.draft ? '  paste again to expand' : '  ⏵⏵ bypass permissions on · 1 shell';
	return ['fixture', rule, '❯ ' + state.draft, rule, footer];
}
function type(command) {
	const text = /send-keys -t %9 -l '([^]*?)'(?: ;|$)/.exec(command)?.[1];
	const enter = command.includes('send-keys -t %9 Enter');
	appendFileSync(join(dir, 'commands'), JSON.stringify({ text: text ?? null, enter }) + '\\n');
	if (text !== undefined) {
		let shown = text.length >= 800 ? '[Pasted text #1' + (enter ? ' +1 lines]' : ']') : text;
		// A very long message arrives as several pastes, sometimes with a short typed remainder.
		if (text.length >= 4000) shown = '[Pasted text #1][Pasted text #2]' + text.slice(-24);
		state.draft = mode === 'foreign' ? 'half a sentence from a person' : shown;
		state.scrolled = mode === 'window-80x24' && Buffer.byteLength(text) >= 500;
		return;
	}
	state.enters += 1;
	if (mode === 'deaf' || (mode === 'drops-first-enter' && state.enters === 1)) return;
	state.draft = '';
	state.submitted = true;
}
switch (args[2]) {
	case 'list-panes': case 'display-message': process.stdout.write(raw + '\\n'); break;
	case 'capture-pane': process.stdout.write(screen().join('\\n') + '\\n'); break;
	case 'if-shell':
		type(args.at(-1));
		save();
		process.stdout.write('tracker-watchdog-sent\\n');
		break;
	default: process.exit(2);
}
`;
