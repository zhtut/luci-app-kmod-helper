'use strict';
'require rpc';

var callSetHostname = rpc.declare({
	object: 'luci.easy-setup',
	method: 'set_hostname',
	params: ['name'],
	expect: { '': {} }
});

return {
	id: 'basic',
	title: 'Basic',

	render: function(host, current, ES) {
		var nameField = ES.field({
			label: _('Device name (hostname)'),
			placeholder: _('e.g. OpenWrt-Lab'),
			value: current.hostname || '',
			help: _('1-32 characters: letters, digits and hyphens (-). Applies immediately; your connection stays up.'),
			helpDetail: [
				_('The hostname is the name this device announces on your local network. It shows up in your main router\'s device list, so pick something easy to recognize.'),
				_('Changing it is completely safe — the page will not disconnect, and you can change it back at any time.')
			]
		});

		var btn = E('button', { 'class': 'es-btn', 'type': 'button' }, _('Save'));
		btn.addEventListener('click', function() {
			var v = nameField.get();
			var e = ES.validate.hostname(v);
			if (e) { nameField.setError(e); return; }
			nameField.clearError();
			ES.runSave(btn, function() { return callSetHostname(v); });
		});

		host.appendChild(E('div', { 'class': 'es-card' }, [
			E('h3', {}, _('Device Name')),
			E('div', { 'class': 'es-card-descr' }, _('Set a friendly name for this device so you can recognize it on your network.')),
			E('div', { 'class': 'es-current' }, [
				_('Current name:'), ' ', E('code', {}, current.hostname || _('(not set)'))
			]),
			nameField.el,
			btn
		]));
	}
};
