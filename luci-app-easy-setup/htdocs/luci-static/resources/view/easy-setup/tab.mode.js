'use strict';
'require rpc';

var callSetMode = rpc.declare({
	object: 'luci.easy-setup',
	method: 'set_mode',
	params: ['mode', 'lan_ip', 'gw_ip'],
	expect: { '': {} }
});

return {
	id: 'mode',
	title: 'Mode',

	render: function(host, current, ES) {
		var mode = 'bypass';
		var cards = {};

		var row = E('div', { 'class': 'es-mode-row' });
		[
			{
				id: 'bypass',
				name: _('Bypass router (secondary gateway)'),
				desc: _('Your main router keeps dialing and handing out addresses; all traffic flows through this box. Gateway and DNS are pointed at the main router automatically.')
			},
			{
				id: 'ap',
				name: _('Access point (AP)'),
				desc: _('This box becomes a plain WiFi extension of your main router\'s network: DHCP off, firewall open, WiFi bridged into the main network.')
			}
		].forEach(function(m) {
			var card = E('button', {
				'class': 'es-mode' + (m.id === mode ? ' active' : ''),
				'type': 'button'
			}, [ E('b', {}, m.name), E('span', {}, m.desc) ]);
			card.addEventListener('click', function() {
				mode = m.id;
				Object.keys(cards).forEach(function(k) {
					if (k === m.id) cards[k].classList.add('active');
					else cards[k].classList.remove('active');
				});
			});
			cards[m.id] = card;
			row.appendChild(card);
		});

		var ipField = ES.field({
			label: _('New IP for this device'),
			placeholder: _('e.g. 192.168.1.2'),
			value: current.lan_ip || '',
			help: _('Must sit in the main router\'s subnet and must not be used by any other device.'),
			helpDetail: [
				_('After the switch, this is the address you use to open this management page.'),
				_('A common choice: if your main router is 192.168.1.1, give this device 192.168.1.2 (or any free address ending in 2-254).'),
				_('The page will lose its connection while the device restarts its network, then try to jump to the new address automatically.')
			]
		});
		var gwField = ES.field({
			label: _('Main router IP'),
			placeholder: _('e.g. 192.168.1.1'),
			value: current.gateway || '',
			help: _('Auto-filled as ".1" of the address above — change it if your main router uses another address.'),
			helpDetail: [
				_('This is the address of the router that dials the internet and hands out IP addresses (DHCP) — usually the box from your ISP or your main WiFi router.'),
				_('This device will send all internet traffic and DNS queries to it.'),
				_('Not sure? Look at the WiFi you are connected to: the "gateway" shown in your phone\'s WiFi details is this address.')
			]
		});

		/* auto-derive the gateway guess from the device IP until the user
		   edits the gateway field manually */
		var gwTouched = false;
		gwField.input.addEventListener('input', function() { gwTouched = true; });
		ipField.input.addEventListener('input', function() {
			if (gwTouched) return;
			var m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ipField.get());
			if (m) gwField.input.value = m[1] + '.1';
		});

		var btn = E('button', { 'class': 'es-btn danger', 'type': 'button' }, _('Apply mode'));
		btn.addEventListener('click', function() {
			var ip = ipField.get();
			var gw = gwField.get();
			var e = ES.validate.privateIp(ip);
			if (e) { ipField.setError(e); return; }
			ipField.clearError();
			e = ES.validate.privateIp(gw);
			if (e) { gwField.setError(e); return; }
			gwField.clearError();
			if (ip === gw) {
				ipField.setError(_('The device IP cannot be the same as the main router IP'));
				return;
			}
			if (ip.split('.').slice(0, 3).join('.') !== gw.split('.').slice(0, 3).join('.')) {
				ipField.setError(_('Both addresses must be in the same subnet: the first three parts must match, e.g. 192.168.1.2 and 192.168.1.1'));
				return;
			}
			ES.runSave(btn, function() { return callSetMode(mode, ip, gw); }, { okToast: false }).then(function(res) {
				if (!res) return;
				var b = ES.banner({
					title: _('Mode applied — connection lost, this is expected'),
					lines: [
						E('div', {}, mode === 'bypass'
							? _('Bypass router mode is now active.')
							: _('Access point mode is now active.')),
						E('div', {}, _('This device is now reachable at %s (main router: %s). Its network is restarting.').format(ip, gw)),
						E('div', {}, _('If you are connected by WiFi, make sure your cable/WiFi still leads into this device\'s LAN.')),
						res.detail ? E('div', { 'style': 'opacity:.85;font-size:14px' }, res.detail) : null
					]
				});
				ES.probeAndRedirect(ip, b.body);
			});
		});

		host.appendChild(E('div', { 'class': 'es-card' }, [
			E('h3', {}, _('One-click Mode')),
			E('div', { 'class': 'es-warn-note' },
				_('Warning: both modes turn OFF the DHCP server and open the firewall on this device. Only use them when this box sits behind your main router, never as your only router.')),
			E('div', { 'class': 'es-card-descr' },
				_('Pick what this device should become, check the two addresses, click apply. Everything else is configured for you automatically.')),
			row,
			ipField.el,
			gwField.el,
			btn
		]));
	}
};
