/** A fake tmux whose one pane behaves like Claude Code 2.1.332's composer. */
export const claudePasteTmuxFixture = `
const { readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const args = process.argv.slice(2);
const path = join(dirname(process.argv[1]), 'state.json');
const state = JSON.parse(readFileSync(path, 'utf8'));
const layout = 'cos|1800000000|71|%9|200|1800000000|2|3|0|0|0|0|1|1|2.1.332';
const rule = '────────────────';
function screen() {
	const working = state.sent.length && state.reply !== 'done';
	const above = working ? '✻ Inferring… (2s · thinking)' : '⏺ OK';
	const prompt = state.draft ? '❯ [Pasted text #1][Pasted text #2 +1 lines]' : '❯\\u00a0';
	const footer = state.draft ? '  paste again to expand' : '  ⏵⏵ bypass permissions on';
	return ['fixture', above, rule, prompt, rule, footer + (working ? ' · esc to interrupt' : '')];
}
function keys(command) {
	const typed = / -l '((?:[^']|'\\\\'')*)'/.exec(command);
	if (typed) state.draft = typed[1];
	// Text and Enter in one command arrive as one burst: Claude keeps the Enter inside the paste.
	if (typed || !command.includes(' Enter')) return;
	if (state.ignoredEnters > 0) state.ignoredEnters -= 1;
	else if (state.draft) {
		state.sent.push(state.draft);
		state.draft = '';
	}
}
if (args[2] === 'list-panes' || args[2] === 'display-message') process.stdout.write(layout + '\\n');
else if (args[2] === 'capture-pane') process.stdout.write(screen().join('\\n') + '\\n');
else if (args[2] === 'if-shell') {
	keys(args[args.length - 1]);
	writeFileSync(path, JSON.stringify(state));
	process.stdout.write('tracker-watchdog-sent\\n');
} else process.exit(2);
`;
