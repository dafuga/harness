// @harness-uid u_l5cohz6zlc
import type { Guide } from './guide.types';

export const designCanvasGuide: Guide = {
	topic: 'design',
	summary:
		'Design canvases: folders of fixed-size HTML artboards under designs/, authored by any agent with harness design and reviewed in pull requests.',
	steps: [
		'Run harness design list, then harness design new <canvas> --title "<title>" if the screens have no canvas yet.',
		'Add each screen and state: harness design add <canvas> <Name> --size desktop|tablet|mobile|WIDTHxHEIGHT --title "<title>" [--from page.html, or - for standard input].',
		'Change one with harness design update <canvas> <Name> [--from page.html] [--title ...] [--order n] [--at x,y|row]. Editing the files by hand is fine too; harness design list <canvas> reports any problem.',
		'Run harness design render <canvas> and look at the PNGs in output/designs/<canvas>/ before calling a design done. Put them in the pull request description.',
		'Commit designs/<canvas>/ and land it in a pull request. The Hub shows a branch’s version at /projects/<id>/designs/<canvas>?branch=<branch>.',
		'To show a plan its screens, push, then run harness design attach <canvas> --item <tracker id> --stage detail|design [--viewer https://<hub>/projects/<id>].'
	],
	rules: [
		'An artboard is one self-contained file with <meta name="artboard-size" content="WIDTHxHEIGHT">. Styles are inline; images and fonts are data: URLs.',
		'No script, link, frame, object, form, refresh, event handler or external file: the CLI refuses them, and viewers show artboards in a sandbox that runs nothing and loads nothing.',
		'Support both themes: define colour tokens on :root and override them under :root[data-theme="dark"]. The viewer and render set data-theme.',
		'canvas.json holds the title and the artboards in canvas order, each with file and title, and optional x and y. Unplaced artboards form a row.',
		'Renders are proof, not source: they stay out of Git.'
	],
	antiPatterns: [
		'Do not describe a screen only in prose when a plan needs its design.',
		'Do not load a CDN stylesheet, web font or remote image into an artboard.'
	],
	contains: [
		'designs/<canvas>/canvas.json',
		'designs/<canvas>/<Name>.html, one artboard per screen or state'
	],
	exampleCommands: [
		'harness design add needs-you Mobile --size mobile --title "Home on iPhone"',
		'harness design render needs-you --theme dark'
	]
};
