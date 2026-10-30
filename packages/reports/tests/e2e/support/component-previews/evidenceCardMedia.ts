/** A fictional checkout screen used as the image input to an evidence card. */
export const checkoutConfirmation = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560" viewBox="0 0 920 560">
<rect width="920" height="560" fill="#f3f5f8"/>
<rect width="920" height="72" fill="#ffffff"/>
<text x="52" y="46" fill="#18253a" font-family="sans-serif" font-size="24" font-weight="700">Northstar Store</text>
<text x="690" y="46" fill="#526174" font-family="sans-serif" font-size="18">Orders  ·  Account</text>
<rect x="92" y="108" width="736" height="398" rx="18" fill="#ffffff" stroke="#dbe2eb"/>
<circle cx="152" cy="166" r="24" fill="#d9f3e6"/>
<path d="M141 166l8 8 15-17" fill="none" stroke="#198754" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<text x="192" y="159" fill="#18253a" font-family="sans-serif" font-size="28" font-weight="700">Order confirmed</text>
<text x="192" y="190" fill="#526174" font-family="sans-serif" font-size="18">Thanks, Alex. Your order is being prepared.</text>
<path d="M132 226h656" stroke="#e5eaf0"/>
<text x="132" y="271" fill="#526174" font-family="sans-serif" font-size="17">ORDER NUMBER</text>
<text x="132" y="301" fill="#18253a" font-family="sans-serif" font-size="21" font-weight="700">#1048</text>
<text x="516" y="271" fill="#526174" font-family="sans-serif" font-size="17">TOTAL</text>
<text x="516" y="301" fill="#18253a" font-family="sans-serif" font-size="21" font-weight="700">$128.00</text>
<text x="132" y="370" fill="#18253a" font-family="sans-serif" font-size="20">Delivery estimate: 3–5 business days</text>
<text x="132" y="409" fill="#526174" font-family="sans-serif" font-size="17">A confirmation has been sent to your email.</text>
</svg>`;

/** Fictional earlier checkout capture for a before/after evidence pair. */
export const checkoutBefore = checkoutConfirmation
	.replace('Order confirmed', 'Order pending')
	.replace(
		'Thanks, Alex. Your order is being prepared.',
		'Review the order before confirming payment.'
	)
	.replace(
		'A confirmation has been sent to your email.',
		'Confirmation will be sent after payment.'
	);

/** Fictional responsive checkout screens used as gallery inputs. */
export const checkoutMobile = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="680" viewBox="0 0 390 680">
<rect width="390" height="680" fill="#f3f5f8"/><rect width="390" height="64" fill="#fff"/>
<text x="24" y="40" fill="#18253a" font-family="sans-serif" font-size="19" font-weight="700">Northstar Store</text>
<rect x="20" y="88" width="350" height="442" rx="14" fill="#fff" stroke="#dbe2eb"/>
<circle cx="60" cy="130" r="17" fill="#d9f3e6"/><path d="M52 130l6 6 10-12" fill="none" stroke="#198754" stroke-width="4"/>
<text x="88" y="137" fill="#18253a" font-family="sans-serif" font-size="20" font-weight="700">Order confirmed</text>
<text x="40" y="190" fill="#526174" font-family="sans-serif" font-size="15">Thanks, Alex. Your order is being prepared.</text>
<path d="M40 218h310" stroke="#e5eaf0"/><text x="40" y="260" fill="#526174" font-family="sans-serif" font-size="13">ORDER NUMBER</text>
<text x="40" y="286" fill="#18253a" font-family="sans-serif" font-size="18" font-weight="700">#1048</text>
<text x="40" y="334" fill="#526174" font-family="sans-serif" font-size="13">TOTAL</text><text x="40" y="360" fill="#18253a" font-family="sans-serif" font-size="18" font-weight="700">$128.00</text>
<text x="40" y="424" fill="#18253a" font-family="sans-serif" font-size="15">Delivery estimate: 3–5 business days</text>
<text x="40" y="459" fill="#526174" font-family="sans-serif" font-size="13">A confirmation has been sent to your email.</text></svg>`;

export const checkoutTablet = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="650" viewBox="0 0 768 650">
<rect width="768" height="650" fill="#f3f5f8"/><rect width="768" height="68" fill="#fff"/>
<text x="38" y="43" fill="#18253a" font-family="sans-serif" font-size="22" font-weight="700">Northstar Store</text>
<text x="570" y="43" fill="#526174" font-family="sans-serif" font-size="16">Orders · Account</text>
<rect x="60" y="102" width="648" height="420" rx="16" fill="#fff" stroke="#dbe2eb"/>
<circle cx="116" cy="160" r="22" fill="#d9f3e6"/><path d="M106 160l7 7 13-15" fill="none" stroke="#198754" stroke-width="5"/>
<text x="155" y="157" fill="#18253a" font-family="sans-serif" font-size="25" font-weight="700">Order confirmed</text>
<text x="155" y="187" fill="#526174" font-family="sans-serif" font-size="16">Thanks, Alex. Your order is being prepared.</text>
<path d="M96 228h576" stroke="#e5eaf0"/><text x="96" y="274" fill="#526174" font-family="sans-serif" font-size="14">ORDER NUMBER</text>
<text x="96" y="302" fill="#18253a" font-family="sans-serif" font-size="20" font-weight="700">#1048</text>
<text x="400" y="274" fill="#526174" font-family="sans-serif" font-size="14">TOTAL</text><text x="400" y="302" fill="#18253a" font-family="sans-serif" font-size="20" font-weight="700">$128.00</text>
<text x="96" y="382" fill="#18253a" font-family="sans-serif" font-size="17">Delivery estimate: 3–5 business days</text>
<text x="96" y="420" fill="#526174" font-family="sans-serif" font-size="15">A confirmation has been sent to your email.</text></svg>`;
