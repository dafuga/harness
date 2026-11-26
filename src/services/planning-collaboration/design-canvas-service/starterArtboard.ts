// @harness-uid u_2v74d2zvrm
const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A blank artboard with the light and dark tokens a viewer's theme switch selects between. */
export function starterArtboard(title: string, sizeMeta: string): string {
	return `<!doctype html>
<html>
<head>
${sizeMeta}
<title>${escape(title)}</title>
<style>
	:root { --ground: #ffffff; --ink: #16181d; --muted: #5b616e; }
	:root[data-theme='dark'] { --ground: #101218; --ink: #f2f3f5; --muted: #a2a8b4; }
	* { box-sizing: border-box; }
	body { margin: 0; padding: 32px; background: var(--ground); color: var(--ink);
		font: 16px/1.5 system-ui, sans-serif; }
	p { color: var(--muted); }
</style>
</head>
<body>
	<h1>${escape(title)}</h1>
	<p>Replace this with the screen you are designing.</p>
</body>
</html>
`;
}
