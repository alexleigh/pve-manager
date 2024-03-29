Ext.define('PVE.window.Backup', {
    extend: 'Ext.window.Window',

    resizable: false,

    initComponent: function() {
	var me = this;

	if (!me.nodename) {
	    throw "no node name specified";
	}

	if (!me.vmid) {
	    throw "no VM ID specified";
	}

	if (!me.vmtype) {
	    throw "no VM type specified";
	}

	let compressionSelector = Ext.create('PVE.form.CompressionSelector', {
	    name: 'compress',
	    value: 'zstd',
	    fieldLabel: gettext('Compression'),
	});

	let modeSelector = Ext.create('PVE.form.BackupModeSelector', {
	    fieldLabel: gettext('Mode'),
	    value: 'snapshot',
	    name: 'mode',
	});

	let notificationTargetSelector = Ext.create('PVE.form.NotificationTargetSelector', {
	    fieldLabel: gettext('Notification target'),
	    name: 'notification-target',
	    emptyText: Proxmox.Utils.noneText,
	    hidden: true,
	});

	let mailtoField = Ext.create('Ext.form.field.Text', {
	    fieldLabel: gettext('Send email to'),
	    name: 'mailto',
	    emptyText: Proxmox.Utils.noneText,
	});

	let notificationModeSelector = Ext.create('PVE.form.NotificationModeSelector', {
	    fieldLabel: gettext('Notify via'),
	    value: 'mailto',
	    name: 'notification-mode',
	    listeners: {
		change: function(f, v) {
		    let mailSelected = v === 'mailto';
		    notificationTargetSelector.setHidden(mailSelected);
		    mailtoField.setHidden(!mailSelected);
		},
	    },
	});

	const keepNames = [
	    ['keep-last', gettext('Keep Last')],
	    ['keep-hourly', gettext('Keep Hourly')],
	    ['keep-daily', gettext('Keep Daily')],
	    ['keep-weekly', gettext('Keep Weekly')],
	    ['keep-monthly', gettext('Keep Monthly')],
	    ['keep-yearly', gettext('Keep Yearly')],
	];

	let pruneSettings = keepNames.map(
	    name => Ext.create('Ext.form.field.Display', {
		name: name[0],
		fieldLabel: name[1],
		hidden: true,
	    }),
	);

	let removeCheckbox = Ext.create('Proxmox.form.Checkbox', {
	    name: 'remove',
	    checked: false,
	    hidden: true,
	    uncheckedValue: 0,
	    fieldLabel: gettext('Prune'),
	    autoEl: {
		tag: 'div',
		'data-qtip': gettext('Prune older backups afterwards'),
	    },
	    handler: function(checkbox, value) {
		pruneSettings.forEach(field => field.setHidden(!value));
		me.down('label[name="pruneLabel"]').setHidden(!value);
	    },
	});

	let initialDefaults = false;

	var storagesel = Ext.create('PVE.form.StorageSelector', {
	    nodename: me.nodename,
	    name: 'storage',
	    fieldLabel: gettext('Storage'),
	    storageContent: 'backup',
	    allowBlank: false,
	    listeners: {
		change: function(f, v) {
		    if (!initialDefaults) {
			me.setLoading(false);
		    }

		    if (v === null || v === undefined || v === '') {
			return;
		    }

		    let store = f.getStore();
		    let rec = store.findRecord('storage', v, 0, false, true, true);

		    if (rec && rec.data && rec.data.type === 'pbs') {
			compressionSelector.setValue('zstd');
			compressionSelector.setDisabled(true);
		    } else if (!compressionSelector.getEditable()) {
			compressionSelector.setDisabled(false);
		    }

		    Proxmox.Utils.API2Request({
			url: `/nodes/${me.nodename}/vzdump/defaults`,
			method: 'GET',
			params: {
			    storage: v,
			},
			waitMsgTarget: me,
			success: function(response, opts) {
			    const data = response.result.data;

			    if (!initialDefaults && data['notification-mode'] !== undefined) {
				notificationModeSelector.setValue(data['notification-mode']);
			    }
			    if (!initialDefaults && data['notification-channel'] !== undefined) {
				notificationTargetSelector.setValue(data['notification-channel']);
			    }
			    if (!initialDefaults && data.mailto !== undefined) {
				mailtoField.setValue(data.mailto);
			    }
			    if (!initialDefaults && data.mode !== undefined) {
				modeSelector.setValue(data.mode);
			    }
			    if (!initialDefaults && (data['notes-template'] ?? false)) {
				me.down('field[name=notes-template]').setValue(
				    PVE.Utils.unEscapeNotesTemplate(data['notes-template']),
				);
			    }

			    initialDefaults = true;

			    // always update storage dependent properties
			    if (data['prune-backups'] !== undefined) {
				const keepParams = PVE.Parser.parsePropertyString(
				    data["prune-backups"],
				);
				if (!keepParams['keep-all']) {
				    removeCheckbox.setHidden(false);
				    pruneSettings.forEach(function(field) {
					const keep = keepParams[field.name];
					if (keep) {
					    field.setValue(keep);
					} else {
					    field.reset();
					}
				    });
				    return;
				}
			    }

			    // no defaults or keep-all=1
			    removeCheckbox.setHidden(true);
			    removeCheckbox.setValue(false);
			    pruneSettings.forEach(field => field.reset());
			},
			failure: function(response, opts) {
			    initialDefaults = true;

			    removeCheckbox.setHidden(true);
			    removeCheckbox.setValue(false);
			    pruneSettings.forEach(field => field.reset());

			    Ext.Msg.alert(gettext('Error'), response.htmlStatus);
			},
		    });
		},
	    },
	});

	let protectedCheckbox = Ext.create('Proxmox.form.Checkbox', {
	    name: 'protected',
	    checked: false,
	    uncheckedValue: 0,
	    fieldLabel: gettext('Protected'),
	});

	me.formPanel = Ext.create('Proxmox.panel.InputPanel', {
	    bodyPadding: 10,
	    border: false,
	    column1: [
		storagesel,
		modeSelector,
		protectedCheckbox,
	    ],
	    column2: [
		compressionSelector,
		notificationModeSelector,
		notificationTargetSelector,
		mailtoField,
		removeCheckbox,
	    ],
	    columnB: [
		{
		    xtype: 'textareafield',
		    name: 'notes-template',
		    fieldLabel: gettext('Notes'),
		    anchor: '100%',
		    value: '{{guestname}}',
		},
		{
		    xtype: 'box',
		    style: {
			margin: '8px 0px',
			'line-height': '1.5em',
		    },
		    html: Ext.String.format(
			gettext('Possible template variables are: {0}'),
			PVE.Utils.notesTemplateVars.map(v => `<code>{{${v}}}</code>`).join(', '),
		    ),
		},
		{
		    xtype: 'label',
		    name: 'pruneLabel',
		    text: gettext('Storage Retention Configuration') + ':',
		    hidden: true,
		},
		{
		    layout: 'hbox',
		    border: false,
		    defaults: {
			border: false,
			layout: 'anchor',
			flex: 1,
		    },
		    items: [
			{
			    padding: '0 10 0 0',
			    defaults: {
				labelWidth: 110,
			    },
			    items: [
				pruneSettings[0],
				pruneSettings[2],
				pruneSettings[4],
			    ],
			},
			{
			    padding: '0 0 0 10',
			    defaults: {
				labelWidth: 110,
			    },
			    items: [
				pruneSettings[1],
				pruneSettings[3],
				pruneSettings[5],
			    ],
			},
		    ],
		},
	    ],
	});

	var submitBtn = Ext.create('Ext.Button', {
	    text: gettext('Backup'),
	    handler: function() {
		var storage = storagesel.getValue();
		let values = me.formPanel.getValues();
		var params = {
		    storage: storage,
		    vmid: me.vmid,
		    mode: values.mode,
		    remove: values.remove,
		};

		if (values.mailto && values['notification-mode'] === 'mailto') {
		    params.mailto = values.mailto;
		}

		if (values['notification-target'] &&
		    values['notification-mode'] === 'notification-target') {
		    params['notification-target'] = values['notification-target'];
		}

		if (values.compress) {
		    params.compress = values.compress;
		}

		if (values.protected) {
		    params.protected = values.protected;
		}

		if (values['notes-template']) {
		    params['notes-template'] = PVE.Utils.escapeNotesTemplate(
			values['notes-template']);
		}

		Proxmox.Utils.API2Request({
		    url: '/nodes/' + me.nodename + '/vzdump',
		    params: params,
		    method: 'POST',
		    failure: function(response, opts) {
			Ext.Msg.alert('Error', response.htmlStatus);
		    },
		    success: function(response, options) {
			// close later so we reload the grid
			// after the task has completed
			me.hide();

			var upid = response.result.data;

			var win = Ext.create('Proxmox.window.TaskViewer', {
			    upid: upid,
			    listeners: {
				close: function() {
				    me.close();
				},
			    },
			});
			win.show();
		    },
		});
	    },
	});

	var helpBtn = Ext.create('Proxmox.button.Help', {
	    onlineHelp: 'chapter_vzdump',
	    listenToGlobalEvent: false,
	    hidden: false,
	});

	var title = gettext('Backup') + " " +
	    (me.vmtype === 'lxc' ? "CT" : "VM") +
	    " " + me.vmid;

	Ext.apply(me, {
	    title: title,
	    modal: true,
	    layout: 'auto',
	    border: false,
	    width: 600,
	    items: [me.formPanel],
	    buttons: [helpBtn, '->', submitBtn],
	    listeners: {
		afterrender: function() {
		    /// cleared within the storage selector's change listener
		    me.setLoading(gettext('Please wait...'));
		    storagesel.setValue(me.storage);
		},
	    },
	});

	me.callParent();
    },
});
