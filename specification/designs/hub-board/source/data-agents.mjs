// Sample agents and scheduled runs for the board designs. All of it is made up.

export const asking = [
	{
		initials: 'HC',
		name: 'Harness Coder',
		sub: 'Which layout should the canvas open with?',
		when: '2h 14m'
	},
	{
		initials: 'NC',
		name: 'Notes Coder',
		sub: 'Approve the spec before the build starts?',
		when: '46m'
	},
	{ initials: 'ST', name: 'Shop Tester', sub: 'Spend up to $5 on live tests today?', when: '12m' }
];

export const working = [
	{ initials: 'CS', name: 'Chief of Staff', sub: 'Watching 7 sessions', tone: 'active' },
	{
		initials: 'HB',
		name: 'Harness Builder',
		sub: 'Board view as the Hub home page',
		tone: 'active'
	},
	{ initials: 'HP', name: 'Harness iPhone', sub: 'Realtime inbox on iPhone', tone: 'active' },
	{ initials: 'SC', name: 'Shop Coder', sub: 'Checkout tests in mock mode', tone: 'active' }
];

export const scheduled = [
	{ when: 'Today 22:00', title: 'Nightly browser tests', meta: 'Shop site · Primary Mac' },
	{ when: 'Sun 09:00', title: 'Dependency update check', meta: 'Harness · MacBook 2' },
	{ when: 'Mon 08:30', title: 'Weekly quota report', meta: 'Harness · Primary Mac' },
	{ when: 'Mon 09:00', title: 'Backup check', meta: 'Notes app · Box' },
	{ when: 'Tue 07:00', title: 'Store listing check', meta: 'Shop site · Primary Mac' }
];
