'use strict';
'require rpc';

var callSetPassword = rpc.declare({
	object: 'luci.easy-setup',
	method: 'set_password',
	params: ['password'],
	expect: { '': {} }
});

return {
	id: 'password',
	title: 'Password',

	render: function(host, current, ES) {
		var pw1 = ES.field({
			label: _('New admin password'),
			type: 'password',
			placeholder: _('At least 8 characters'),
			help: _('Used for the web interface and SSH login (user "root").'),
			helpDetail: [
				_('The password protects your router from everyone else on your network. Use at least 8 characters mixing letters and digits.'),
				_('Your current login session stays valid — the new password is needed the next time you log in.'),
				_('If you ever forget it, the only way back is a hardware reset of the device.')
			]
		});
		var pw2 = ES.field({
			label: _('Repeat new password'),
			type: 'password',
			placeholder: _('Type the same password again'),
			help: _('Both boxes must match — this guards against typos.')
		});

		var btn = E('button', { 'class': 'es-btn', 'type': 'button' }, _('Save'));
		btn.addEventListener('click', function() {
			/* raw values, not .get(): a password may legally end with spaces */
			var a = pw1.input.value;
			var b = pw2.input.value;
			var e = ES.validate.password(a);
			if (e) { pw1.setError(e); return; }
			pw1.clearError();
			if (a !== b) { pw2.setError(_('The two passwords do not match')); return; }
			pw2.clearError();
			ES.runSave(btn, function() { return callSetPassword(a); });
		});

		host.appendChild(E('div', { 'class': 'es-card' }, [
			E('h3', {}, _('Admin Password')),
			E('div', { 'class': 'es-card-descr' }, _('Change the password of the "root" administrator account. Takes effect immediately, no reconnect needed.')),
			pw1.el,
			pw2.el,
			btn
		]));
	}
};
