'use strict';
'require rpc';

var callSetWifi = rpc.declare({
	object: 'luci.easy-setup',
	method: 'set_wifi',
	params: ['ssid', 'key'],
	expect: { '': {} }
});

return {
	id: 'wifi',
	title: 'WiFi',

	render: function(host, current, ES) {
		var wifiList = current.wifi || [];
		var firstSsid = '';
		for (var i = 0; i < wifiList.length; i++) {
			if (wifiList[i].ssid) { firstSsid = wifiList[i].ssid; break; }
		}

		var ssidField = ES.field({
			label: _('WiFi name (SSID)'),
			placeholder: _('e.g. MyHome-WiFi'),
			value: firstSsid,
			help: _('One name for all bands (2.4G and 5G at once). Up to 32 characters.'),
			helpDetail: [
				_('This is the network name your phones and laptops see when searching for WiFi.'),
				_('All wireless interfaces of this device are changed together, so you only manage one name.'),
				_('After saving, every device — including the one you are using right now — is dropped from the WiFi and must reconnect to the new name.')
			]
		});
		var keyField = ES.field({
			label: _('WiFi password'),
			type: 'password',
			placeholder: _('Leave empty to keep the current password'),
			help: _('8-63 characters. Leave empty if you only want to change the name.'),
			helpDetail: [
				_('The password every device must enter to join your WiFi.'),
				_('If the WiFi is currently open (no password) and you set one here, WPA2 encryption is enabled automatically.'),
				_('Leave the box empty to keep whatever password is set right now.')
			]
		});

		var btn = E('button', { 'class': 'es-btn danger', 'type': 'button' }, _('Save and apply'));
		btn.addEventListener('click', function() {
			var ssid = ssidField.get();
			var key = keyField.input.value; /* raw: passwords keep their spaces */
			var e = ES.validate.ssid(ssid);
			if (e) { ssidField.setError(e); return; }
			ssidField.clearError();
			if (key) {
				e = ES.validate.wifiKey(key);
				if (e) { keyField.setError(e); return; }
			}
			keyField.clearError();
			ES.runSave(btn, function() { return callSetWifi(ssid, key); }, { okToast: false }).then(function(res) {
				if (!res) return;
				ES.banner({
					title: _('WiFi changed — you have been disconnected'),
					lines: [
						E('div', {}, _('All phones and computers were dropped from the WiFi. This is normal.')),
						E('div', {}, _('Step 1: on your phone/computer, connect to the new WiFi network:')),
						E('div', { 'class': 'es-banner-url' }, ssid),
						key ? E('div', {}, _('Use the new password you just set.'))
						    : E('div', {}, _('The password was not changed.')),
						E('div', { 'style': 'margin-top:8px' }, _('Step 2: open this management page again:')),
						E('div', { 'class': 'es-banner-url' }, location.href)
					]
				});
			});
		});

		host.appendChild(E('div', { 'class': 'es-card' }, [
			E('h3', {}, _('WiFi Name and Password')),
			E('div', { 'class': 'es-card-descr' }, wifiList.length
				? _('This device has %d wireless interface(s). This one form changes all of them at once.').format(wifiList.length)
				: _('No wireless interface was found on this device — it may not have WiFi.')),
			wifiList.length ? E('div', { 'class': 'es-current' }, [ _('Current name:'), ' ', E('code', {}, firstSsid || _('(empty)')) ]) : null,
			ssidField.el,
			keyField.el,
			btn
		]));
	}
};
