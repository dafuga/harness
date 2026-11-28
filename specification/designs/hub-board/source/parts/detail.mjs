// Card detail (side panel or sheet) and a plain list page that shows the dock away from Home.
import { scheduled } from '../data-agents.mjs';
import { pill } from './bits.mjs';
import { options } from './dock.mjs';

const fact = (label, value) =>
	`<div class="fact"><span class="kicker">${label}</span><b>${value}</b></div>`;

const notes = [
	['15:28', 'Asked which layout the canvas should open with.'],
	['15:21', 'Viewer checks pass on desktop and iPhone widths.'],
	['13:02', 'Started on Primary Mac with Fable 5.2.']
];

export const detailBody = () => `
<div class="detail-head"><span class="muted" style="font-weight: 600">Harness</span>${pill('needs', 'Needs you')}<span class="muted num">waiting 2h 14m</span><button type="button" class="icon-btn" aria-label="Close">&times;</button></div>
<h2 class="detail-title">Design canvas viewer</h2>
<div class="facts">${fact('Agent', 'Harness Coder')}${fact('Computer', 'Primary Mac')}${fact('Model', 'Fable 5.2')}${fact('Started', 'Today 13:02')}</div>
<div class="ask">
	<p class="ask-q">Which layout should the design canvas open with?</p>
	<p class="muted" style="font-size: 13px">I want to open on the grid so every screen is visible before you zoom into one.</p>
	${options()}
</div>
<div class="detail-actions"><button type="button" class="btn">Open chat</button><button type="button" class="btn">View designs</button></div>
<section class="section">
	<h3 class="kicker">Latest notes</h3>
	<ol class="notes">${notes.map(([at, text]) => `<li class="note"><time>${at}</time><span>${text}</span></li>`).join('')}</ol>
</section>`;

export const detail = () => `
<div class="scrim"></div>
<aside class="detail" aria-label="Design canvas viewer">${detailBody()}</aside>`;

const row = (r) => `
<li class="list-row"><span class="when">${r.when}</span><span class="grow"><span style="font-weight: 500">${r.title}</span></span><span class="muted">${r.meta}</span></li>`;

export const scheduledPage = () => `
<div><h1 class="page-title">Scheduled</h1><p class="muted">5 runs planned · next today 22:00</p></div>
<ul class="list-card">${scheduled.map(row).join('')}</ul>`;
