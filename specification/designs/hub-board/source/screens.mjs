// Every artboard on the canvas: file name, title, size, place on the canvas and its markup.
import { board } from './parts/board.mjs';
import { laneBoard, laneToolbar, phoneLanes, sideHead, sidebar, tabbar } from './parts/alt.mjs';
import { detail, detailBody, scheduledPage } from './parts/detail.mjs';
import { dock, dockBody, dockChat, dockFoot, dockHead, dockPill } from './parts/dock.mjs';
import {
	phoneCards,
	phoneChips,
	phoneDock,
	phoneStats,
	phoneTabs,
	phoneTop
} from './parts/phone.mjs';
import { chips, stats, statusline, toolbar, topbar } from './parts/shell.mjs';

const desktop = [1440, 900];

const home = (overlay, opts) => `
${topbar()}
<main class="page">${stats()}${toolbar()}${board(opts)}</main>
${statusline()}${overlay}`;

const otherPage = () => `
${topbar('Scheduled')}
<main class="page" style="gap: 20px; padding-top: 28px">${scheduledPage()}</main>
${dockPill()}`;

const recommended = [
	['BoardDesktop', 'Board home (desktop)', home(dockPill())],
	['BoardDesktopDock', 'Agents dock open (desktop)', home(dock())],
	['BoardDesktopChat', 'Dock: answer an agent in chat (desktop)', home(dockChat())],
	[
		'BoardDesktopDetail',
		'Card detail: answer a blocked task (desktop)',
		home(detail(), { selected: 'Design canvas viewer' })
	],
	['DockOtherPage', 'Agents dock on another page (desktop)', otherPage()]
];

const phone = [390, 844];
const phoneHome = (tab, overlay = phoneDock()) => `
${phoneTop()}
<main class="page">${phoneStats()}${phoneChips()}${phoneTabs(tab)}${phoneCards(tab)}</main>
${overlay}`;
const agentsSheet = `<aside class="sheet" aria-label="Agents">${dockHead()}${dockBody()}${dockFoot()}</aside>`;
const detailSheet = `<aside class="sheet pad" aria-label="Design canvas viewer">${detailBody()}</aside>`;

const recommendedPhone = [
	['BoardPhone', 'Board home (iPhone): In progress', phoneHome('active')],
	['BoardPhoneBlocked', 'Board home (iPhone): Blocked', phoneHome('blocked')],
	['BoardPhoneDock', 'Agents sheet (iPhone)', phoneHome('active', agentsSheet)],
	['BoardPhoneDetail', 'Card detail sheet (iPhone)', phoneHome('blocked', detailSheet)]
].map(([file, title, body]) => [file, title, body, phone, 'phone']);

const sideDesktop = `
${topbar()}
<div class="with-side">${sidebar()}<main class="page">${sideHead()}<div class="toolbar">${chips()}</div>${board({ limit: 5 })}</main></div>`;
const sidePhone = `
${phoneTop()}
<main class="page">${phoneChips()}${phoneTabs('active')}${phoneCards('active')}</main>
${tabbar()}`;
const lanesDesktop = `
${topbar()}
<main class="page">${stats()}${laneToolbar()}${laneBoard()}</main>
${statusline()}${dockPill()}`;
const lanesPhone = `
${phoneTop()}
<main class="page">${phoneStats()}${phoneLanes()}</main>
${phoneDock()}`;

const alternatives = [
	['SidebarDesktop', 'Alternative: agents sidebar (desktop)', sideDesktop],
	['SidebarPhone', 'Alternative: agents sidebar (iPhone)', sidePhone, phone, 'phone'],
	['LanesDesktop', 'Alternative: project lanes (desktop)', lanesDesktop, [1440, 1160]],
	['LanesPhone', 'Alternative: project lanes (iPhone)', lanesPhone, phone, 'phone']
];

const place = (rows) =>
	rows.flatMap((row, y) =>
		row.map(([file, title, body, size = desktop, kind = 'desktop'], x) => ({
			file: `${file}.html`,
			title,
			size,
			kind,
			body,
			x: row.slice(0, x).reduce((sum, [, , , s = desktop]) => sum + s[0] + 80, 0),
			y: y * 1000
		}))
	);

export const screens = (rows = [recommended, recommendedPhone, alternatives]) => place(rows);
