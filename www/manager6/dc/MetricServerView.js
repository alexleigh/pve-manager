Ext.define('PVE.dc.MetricServerView', {
    extend: 'Ext.grid.Panel',
    alias: ['widget.pveMetricServerView'],

    stateful: true,
    stateId: 'grid-metricserver',

    controller: {
	xclass: 'Ext.app.ViewController',

	render_type: function(value) {
	    switch (value) {
		case 'influxdb': return "InfluxDB";
		case 'graphite': return "Graphite";
		default: return Proxmox.Utils.unknownText;
	    }
	},

	editWindow: function(xtype, id) {
	    let me = this;
	    Ext.create(`PVE.dc.${xtype}Edit`, {
		serverid: id,
		autoShow: true,
		listeners: {
		    destroy: () => me.reload(),
		},
	    });
	},

	addServer: function(button) {
	    this.editWindow(button.text);
	},

	editServer: function() {
	    let me = this;
	    let view = me.getView();
	    let selection = view.getSelection();
	    if (!selection || selection.length < 1) {
		return;
	    }

	    let cfg = selection[0].data;

	    let xtype = me.render_type(cfg.type);
	    me.editWindow(xtype, cfg.id);
	},

	reload: function() {
	    this.getView().getStore().load();
	},
    },

    store: {
	autoLoad: true,
	id: 'metricservers',
	proxy: {
	    type: 'proxmox',
	    url: '/api2/json/cluster/metrics/server',
	},
    },

    columns: [
	{
	    text: gettext('Name'),
	    flex: 2,
	    dataIndex: 'id',
	},
	{
	    text: gettext('Type'),
	    flex: 1,
	    dataIndex: 'type',
	    renderer: 'render_type',
	},
	{
	    text: gettext('Enabled'),
	    dataIndex: 'disable',
	    width: 100,
	    renderer: Proxmox.Utils.format_neg_boolean,
	},
	{
	    text: gettext('Server'),
	    width: 200,
	    dataIndex: 'server',
	},
	{
	    text: gettext('Port'),
	    width: 100,
	    dataIndex: 'port',
	},
    ],

    tbar: [
	{
	    text: gettext('Add'),
	    menu: [
		{
		    text: 'Graphite',
		    iconCls: 'fa fa-fw fa-bar-chart',
		    handler: 'addServer',
		},
		{
		    text: 'InfluxDB',
		    iconCls: 'fa fa-fw fa-bar-chart',
		    handler: 'addServer',
		},
	    ],
	},
	{
	    text: gettext('Edit'),
	    xtype: 'proxmoxButton',
	    handler: 'editServer',
	    disabled: true,
	},
	{
	    xtype: 'proxmoxStdRemoveButton',
	    baseurl: `/api2/extjs/cluster/metrics/server`,
	    callback: 'reload',
	},
    ],

    listeners: {
	itemdblclick: 'editServer',
    },

    initComponent: function() {
	var me = this;

	me.callParent();

	Proxmox.Utils.monStoreErrors(me, me.getStore());
    },
});

Ext.define('PVE.dc.MetricServerBaseEdit', {
    extend: 'Proxmox.window.Edit',
    mixins: ['Proxmox.Mixin.CBind'],

    cbindData: function() {
	let me = this;
	me.isCreate = !me.serverid;
	me.serverid = me.serverid || "";
	me.url = `/api2/extjs/cluster/metrics/server/${me.serverid}`;
	me.method = me.isCreate ? 'POST' : 'PUT';
	if (!me.isCreate) {
	    me.subject = `${me.subject}: ${me.serverid}`;
	}
	return {};
    },

    submitUrl: function(url, values) {
	return this.isCreate ? `${url}/${values.id}` : url;
    },

    initComponent: function() {
	let me = this;

	me.callParent();

	if (me.serverid) {
	    me.load({
		success: function(response, options) {
		    let values = response.result.data;
		    values.enable = !values.disable;
		    me.down('inputpanel').setValues(values);
		},
	    });
	}
    },
});

Ext.define('PVE.dc.InfluxDBEdit', {
    extend: 'PVE.dc.MetricServerBaseEdit',
    mixins: ['Proxmox.Mixin.CBind'],

    subject: 'InfluxDB',

    items: [
	{
	    xtype: 'inputpanel',

	    onGetValues: function(values) {
		values.disable = values.enable ? 0 : 1;
		delete values.enable;
		return values;
	    },

	    column1: [
		{
		    xtype: 'hidden',
		    name: 'type',
		    value: 'influxdb',
		    cbind: {
			submitValue: '{isCreate}',
		    },
		},
		{
		    xtype: 'pmxDisplayEditField',
		    name: 'id',
		    fieldLabel: gettext('Name'),
		    allowBlank: false,
		    cbind: {
			editable: '{isCreate}',
			value: '{serverid}',
		    },
		},
		{
		    xtype: 'proxmoxtextfield',
		    name: 'server',
		    fieldLabel: gettext('Server'),
		    allowBlank: false,
		},
	    ],

	    column2: [
		{
		    xtype: 'checkbox',
		    name: 'enable',
		    fieldLabel: gettext('Enabled'),
		    inputValue: 1,
		    uncheckedValue: 0,
		    checked: true,
		},
		{
		    xtype: 'proxmoxintegerfield',
		    name: 'port',
		    fieldLabel: gettext('Port'),
		    value: 8089,
		    minValue: 1,
		    maximum: 65536,
		    allowBlank: false,
		},
	    ],

	    advancedColumn2: [
		{
		    xtype: 'proxmoxintegerfield',
		    name: 'mtu',
		    fieldLabel: 'MTU',
		    minValue: 1,
		    emptyText: '1500',
		    submitEmpty: false,
		    cbind: {
			deleteEmpty: '{!isCreate}',
		    },
		},
	    ],
	},
    ],
});

Ext.define('PVE.dc.GraphiteEdit', {
    extend: 'PVE.dc.MetricServerBaseEdit',
    mixins: ['Proxmox.Mixin.CBind'],

    subject: 'Graphite',

    items: [
	{
	    xtype: 'inputpanel',

	    onGetValues: function(values) {
		values.disable = values.enable ? 0 : 1;
		delete values.enable;
		return values;
	    },

	    column1: [
		{
		    xtype: 'hidden',
		    name: 'type',
		    value: 'graphite',
		    cbind: {
			submitValue: '{isCreate}',
		    },
		},
		{
		    xtype: 'pmxDisplayEditField',
		    name: 'id',
		    fieldLabel: gettext('Name'),
		    allowBlank: false,
		    cbind: {
			editable: '{isCreate}',
			value: '{serverid}',
		    },
		},
		{
		    xtype: 'proxmoxtextfield',
		    name: 'server',
		    fieldLabel: gettext('Server'),
		    allowBlank: false,
		},
	    ],

	    column2: [
		{
		    xtype: 'checkbox',
		    name: 'enable',
		    fieldLabel: gettext('Enabled'),
		    inputValue: 1,
		    uncheckedValue: 0,
		    checked: true,
		},
		{
		    xtype: 'proxmoxintegerfield',
		    name: 'port',
		    fieldLabel: gettext('Port'),
		    value: 2003,
		    minimum: 1,
		    maximum: 65536,
		    allowBlank: false,
		},
		{
		    fieldLabel: gettext('Path'),
		    xtype: 'proxmoxtextfield',
		    emptyText: 'proxmox',
		    name: 'path',
		    cbind: {
			deleteEmpty: '{!isCreate}',
		    },
		},
	    ],

	    advancedColumn1: [
		{
		    xtype: 'proxmoxKVComboBox',
		    name: 'proto',
		    fieldLabel: gettext('Protocol'),
		    value: '__default__',
		    cbind: {
			deleteEmpty: '{!isCreate}',
		    },
		    comboItems: [
			['__default__', 'UDP'],
			['tcp', 'TCP'],
		    ],
		    listeners: {
			change: function(field, value) {
			    let me = this;
			    me.up('inputpanel').down('field[name=timeout]').setDisabled(value !== 'tcp');
			    me.up('inputpanel').down('field[name=mtu]').setDisabled(value === 'tcp');
			},
		    },
		},
	    ],

	    advancedColumn2: [
		{
		    xtype: 'proxmoxintegerfield',
		    name: 'mtu',
		    fieldLabel: 'MTU',
		    minimum: 1,
		    emptyText: '1500',
		    submitEmpty: false,
		    cbind: {
			deleteEmpty: '{!isCreate}',
		    },
		},
		{
		    xtype: 'proxmoxintegerfield',
		    name: 'timeout',
		    fieldLabel: gettext('TCP Timeout'),
		    disabled: true,
		    cbind: {
			deleteEmpty: '{!isCreate}',
		    },
		    minValue: 1,
		    emptyText: 1,
		},
	    ],
	},
    ],
});