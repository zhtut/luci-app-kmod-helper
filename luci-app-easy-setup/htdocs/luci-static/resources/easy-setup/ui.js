'use strict';
'require luci';

/* Self-contained UI kit for luci-app-easy-setup: toast, help popover, field
   builder, input validators and the disconnect banner. No native dialogs
   (alert/confirm) and no ui.modal — some LuCI themes render them with an
   unreachable OK button. Everything paints its own colors via ui.css. */

var TOAST_MS = { ok: 3000, err: 5000, warn: 5000 };
var TOAST_ICON = { ok: '✔', err: '✖', warn: '⚠' };
var PROBE_INTERVAL_MS = 2500;
var PROBE_TIMEOUT_MS = 2500;
var PROBE_TOTAL_MS = 30000;

/* inject the stylesheet once (works on 24.10 and 25.x loaders alike) */
(function() {
	if (document.getElementById('es-ui-css')) return;
	var link = document.createElement('link');
	link.id = 'es-ui-css';
	link.rel = 'stylesheet';
	link.href = L.resource('easy-setup/ui.css');
	document.head.appendChild(link);
})();

/* ---------- toast ---------- */

function toastWrap() {
	var w = document.querySelector('.es-toast-wrap');
	if (!w) {
		w = E('div', { 'class': 'es-toast-wrap' });
		document.body.appendChild(w);
	}
	return w;
}

/* toast('ok'|'err'|'warn', title, detail?) — centered, auto-dismiss,
   click to close. detail may contain \n (rendered as separate lines). */
function toast(kind, title, detail) {
	var el = E('div', { 'class': 'es-toast ' + kind }, [
		E('span', { 'class': 'es-toast-icon' }, TOAST_ICON[kind] || '•'),
		E('div', {}, [
			E('div', { 'class': 'es-toast-title' }, title || ''),
			detail ? E('div', { 'class': 'es-toast-detail' }, detail) : null
		])
	]);
	var closed = false;
	var kill = function() {
		if (closed || !el.parentNode) return;
		closed = true;
		el.classList.add('es-out');
		setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
	};
	el.addEventListener('click', kill);
	toastWrap().appendChild(el);
	setTimeout(kill, TOAST_MS[kind] || 4000);
}

/* ---------- help popover ---------- */

var openPop = null;

function closePopover() {
	if (openPop && openPop.parentNode) openPop.parentNode.removeChild(openPop);
	openPop = null;
	document.removeEventListener('mousedown', onDocDown, true);
}

function onDocDown(ev) {
	if (openPop && !openPop.contains(ev.target)) closePopover();
}

/* popover(anchorEl, [string|node, ...]) — positioned below the anchor,
   closes on outside click. One popover at a time. */
function popover(anchor, contents) {
	closePopover();
	var nodes = (contents || []).map(function(c) {
		return (typeof c === 'string') ? E('p', {}, c) : c;
	});
	var pop = E('div', { 'class': 'es-pop' }, nodes);
	document.body.appendChild(pop);
	var r = anchor.getBoundingClientRect();
	var left = r.left + window.scrollX;
	var maxLeft = window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8;
	pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
	pop.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
	openPop = pop;
	setTimeout(function() { document.addEventListener('mousedown', onDocDown, true); }, 0);
}

/* ---------- field builder ---------- */

/* field({label, placeholder, help, helpDetail, type, value}) builds the
   3-layer hint system: placeholder (in-box example), helper text (always
   visible under the box) and a "?" popover (deep explanation).
   Returns { el, input, get(), setError(msg), clearError() }. */
function field(opts) {
	var errEl = E('div', { 'class': 'es-error', 'hidden': '' });
	var input = E('input', {
		'class': 'es-input',
		'type': opts.type || 'text',
		'placeholder': opts.placeholder || '',
		'value': (opts.value != null) ? opts.value : '',
		'autocomplete': (opts.type === 'password') ? 'new-password' : 'off'
	});
	input.addEventListener('input', function() {
		input.classList.remove('es-invalid');
		errEl.hidden = true;
		errEl.textContent = '';
	});

	var labelKids = [ E('span', {}, opts.label || '') ];
	if (opts.helpDetail) {
		var btn = E('button', { 'class': 'es-help-btn', 'type': 'button', 'title': _('Help') }, '?');
		btn.addEventListener('click', function(ev) {
			ev.stopPropagation();
			var parts = Array.isArray(opts.helpDetail) ? opts.helpDetail : [opts.helpDetail];
			popover(btn, parts);
		});
		labelKids.unshift(btn);
	}

	var el = E('div', { 'class': 'es-field' }, [
		E('label', { 'class': 'es-field-label' }, labelKids),
		input,
		opts.help ? E('div', { 'class': 'es-helper' }, opts.help) : null,
		errEl
	]);

	return {
		el: el,
		input: input,
		get: function() { return input.value.trim(); },
		setError: function(msg) {
			input.classList.add('es-invalid');
			errEl.textContent = msg;
			errEl.hidden = false;
		},
		clearError: function() {
			input.classList.remove('es-invalid');
			errEl.textContent = '';
			errEl.hidden = true;
		}
	};
}

/* ---------- validators (mirror of the rpcd backend rules) ---------- */
/* Each returns '' when valid, otherwise a translated error message. */

function vIpv4(s) {
	s = (s || '').trim();
	if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(s))
		return _('"%s" is not a valid IP address. Example: 192.168.1.2').format(s);
	var p = s.split('.');
	for (var i = 0; i < 4; i++) {
		if (p[i].length > 1 && p[i].charAt(0) === '0')
			return _('"%s" contains a leading zero (%s). Please remove the extra 0').format(s, p[i]);
		if (parseInt(p[i], 10) > 255)
			return _('"%s": %s is out of the 0-255 range').format(s, p[i]);
	}
	return '';
}

function vPrivateIp(s) {
	var e = vIpv4(s);
	if (e) return e;
	var p = (s || '').trim().split('.').map(Number);
	if (p[3] === 0 || p[3] === 255)
		return _('"%s" is a network/broadcast address and cannot be used by a device. The last digit must be between 1 and 254').format(s.trim());
	var ok = p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31);
	if (!ok)
		return _('"%s" is not a LAN address. Please use a private IP starting with 192.168.x.x (e.g. 192.168.1.2) or 10.x.x.x (e.g. 10.0.0.2)').format(s.trim());
	return '';
}

function vHostname(s) {
	s = (s || '').trim();
	if (!s.length || s.length > 32)
		return _('Hostname must be 1-32 characters long');
	if (!/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/.test(s))
		return _('Hostname may only contain letters, digits and hyphens (-), and must not start or end with a hyphen. Example: OpenWrt-Lab');
	return '';
}

function vPassword(s) {
	return (s || '').length >= 8 ? '' : _('Password is too short: at least 8 characters for safety');
}

function vSsid(s) {
	if (!(s || '').trim().length) return _('WiFi name cannot be empty');
	if (s.length > 32) return _('WiFi name must be at most 32 characters');
	return '';
}

function vWifiKey(s) {
	var l = (s || '').length;
	return (l >= 8 && l <= 63) ? '' : _('WiFi password must be 8-63 characters long');
}

/* ---------- disconnect banner + probe/redirect ---------- */

/* banner({title, lines}) — full-screen red overlay for operations that
   drop the current connection. Returns {el, body} so callers can append. */
function banner(opts) {
	var body = E('div', {}, opts.lines || []);
	var el = E('div', { 'class': 'es-banner' }, [
		E('div', { 'class': 'es-banner-title' }, opts.title || ''),
		body
	]);
	document.body.appendChild(el);
	return { el: el, body: body };
}

function newIpBase(ip) {
	return location.protocol + '//' + ip + (location.port ? ':' + location.port : '');
}

/* Probe the router's new address for ~30s; redirect as soon as it answers,
   otherwise append manual instructions (both http and https).
   shortcut: over HTTPS the self-signed cert of the new IP may fail the probe
   even when reachable — the manual fallback covers that; upgrade would need
   a cert-independent probe which browsers do not offer. */
function probeAndRedirect(ip, bannerBody) {
	var base = newIpBase(ip);
	bannerBody.appendChild(E('div', { 'class': 'es-banner-spin' },
		_('Trying to open the new address %s automatically …').format(base + '/')));
	var deadline = Date.now() + PROBE_TOTAL_MS;
	var tick = function() {
		var ctl = ('AbortController' in window) ? new AbortController() : null;
		var timer = ctl ? setTimeout(function() { ctl.abort(); }, PROBE_TIMEOUT_MS) : null;
		var p = ctl
			? fetch(base + '/', { mode: 'no-cors', cache: 'no-store', signal: ctl.signal })
			: Promise.reject(new Error('fetch unsupported'));
		p.then(function() {
			if (timer) clearTimeout(timer);
			location.href = base + '/';
		}).catch(function() {
			if (timer) clearTimeout(timer);
			if (Date.now() < deadline) {
				setTimeout(tick, PROBE_INTERVAL_MS);
			} else {
				bannerBody.appendChild(E('div', {}, [
					E('div', { 'style': 'margin-top:10px' },
						_('Automatic redirect failed. Please open the new address manually in your browser:')),
					E('div', { 'class': 'es-banner-url' }, 'http://' + ip + '/'),
					E('div', { 'class': 'es-banner-url' }, 'https://' + ip + '/')
				]));
			}
		});
	};
	tick();
}

/* ---------- shared save-button behavior ---------- */

/* runSave(btn, factory, opts) — disable btn and show "Applying…" while the
   RPC write runs, then restore. Toasts the backend result unless
   opts.okToast === false (disconnect flows show their own red banner
   instead). Resolves with the backend response, or null on failure, so
   callers can chain special handling. */
function runSave(btn, factory, opts) {
	opts = opts || {};
	var idle = btn.textContent;
	btn.disabled = true;
	btn.textContent = _('Applying…');
	var restore = function() {
		btn.disabled = false;
		btn.textContent = idle;
	};
	return factory().then(function(res) {
		restore();
		if (res && res.success) {
			if (opts.okToast !== false)
				toast('ok', _('Saved'), res.detail || '');
			return res;
		}
		toast('err', _('Save failed'), (res && res.error) || _('Unknown error'));
		return null;
	}).catch(function(err) {
		restore();
		toast('err', _('Save failed'), (err && err.message) || String(err));
		return null;
	});
}

return {
	toast: toast,
	popover: popover,
	field: field,
	runSave: runSave,
	banner: banner,
	probeAndRedirect: probeAndRedirect,
	newIpBase: newIpBase,
	validate: {
		ipv4: vIpv4,
		privateIp: vPrivateIp,
		hostname: vHostname,
		password: vPassword,
		ssid: vSsid,
		wifiKey: vWifiKey
	}
};
