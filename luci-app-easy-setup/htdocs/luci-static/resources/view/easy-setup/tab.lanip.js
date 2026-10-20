'use strict';
'require rpc';

var callSetLanIp = rpc.declare({
	object: 'luci.easy-setup',
	method: 'set_lan_ip',
	params: ['ip'],
	expect: { '': {} }
});

return {
	id: 'lanip',
	title: 'LAN IP',

	render: function(host, current, ES) {
		var ipField = ES.field({
			label: _('New LAN IP address'),
			placeholder: _('e.g. 192.168.1.2'),
			value: current.lan_ip || '',
			help: _('Private addresses only: 192.168.x.x, 10.x.x.x or 172.16.x.x - 172.31.x.x. The last digit must be 1-254.'),
			helpDetail: [
				_('The LAN IP is the address you type in the browser to manage this device, e.g. http://192.168.1.1/.'),
				_('After saving, the device restarts its network and this page loses the connection — that is completely normal. The page will try to jump to the new address automatically; if it cannot, the new address is shown in red so you can open it manually.'),
				_('Pick an address no other device on your network uses, and write it down — you will need it to log in from now on.')
			]
		});

		var btn = E('button', { 'class': 'es-btn danger', 'type': 'button' }, _('Save and apply'));
		btn.addEventListener('click', function() {
			var v = ipField.get();
			var e = ES.validate.privateIp(v);
			if (e) { ipField.setError(e); return; }
			if (v === (current.lan_ip || '')) {
				ipField.setError(_('This is already the current address — nothing to change'));
				return;
			}
			ipField.clearError();
			ES.runSave(btn, function() { return callSetLanIp(v); }, { okToast: false }).then(function(res) {
				if (!res) return;
				var b = ES.banner({
					title: _('Connection lost — this is expected'),
					lines: [
						E('div', {}, _('The LAN IP has been changed to %s. The device is restarting its network now.').format(v)),
						res.detail ? E('div', { 'style': 'opacity:.85;font-size:14px' }, res.detail) : null
					]
				});
				ES.probeAndRedirect(v, b.body);
			});
		});

		host.appendChild(E('div', { 'class': 'es-card' }, [
			E('h3', {}, _('LAN IP Address')),
			E('div', { 'class': 'es-card-descr' }, _('The address you use to open this management page in your browser.')),
			E('div', { 'class': 'es-current' }, [
				_('Current:'), ' ', E('code', {}, current.lan_ip || '?'),
				'  ', _('Netmask:'), ' ', E('code', {}, current.lan_netmask || '?')
			]),
			ipField.el,
			btn
		]));
	}
};
