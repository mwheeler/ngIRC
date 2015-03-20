angular.module('IRC', [])
.factory('Server', function()
{
	var net = require("net");
	var events = require("events");
	var Protocol = require('irc-protocol');

	// Dodgy jQuery based IRC server prototype (needs MVC-ing using a proper framework)
	function Server(name, options)
	{
		events.EventEmitter.call(this);
		options = options || {};

		// Basic server state
		this.name = name;
		this.channels = {};
		this.connected = false;
		this.host = options.host || ('irc.' + name + '.net');
		this.port = options.port || 6667;

		// {nick,user,real}name logic
		var default_name = 'Guest-' + Math.round(Math.random()*10000);

		this.priv = {
			nickname: options.nickname || default_name,
			username: options.username || default_name,
			realname: options.realname || ''
		};

		var update_nick = function() // Updates nickname with server
		{
			this.serialiser.write({command: "NICK", parameters: [this.nickname]});
		}.bind(this);

		var update_user = function() // Updates user/real names with server
		{
			this.serialiser.write({command: "USER", parameters: [this.username, 0, 0, this.realname]});
		}.bind(this);

		// Automatic server-side updating of names on property set
		Object.defineProperty(this, 'nickname', {
			get: function() { return this.priv.nickname; },
			set: function(value) { this.priv.nickname = value; if(this.connected) update_nick(); },
			enumerable: true,
			configurable: false
		});

		Object.defineProperty(this, 'username', {
			get: function() { return this.priv.username; },
			set: function(value) { this.priv.username = value; if(this.connected) update_user(); },
			enumerable: true,
			configurable: false
		});

		Object.defineProperty(this, 'realname', {
			get: function() { return this.priv.realname; },
			set: function(value) { this.priv.realname = value; if(this.connected) update_user(); },
			enumerable: true,
			configurable: false
		});

		// IRC parser/serialiser/socket (internals)
		this.parser = new Protocol.Parser();

		// Parser processor
		this.parser.on('readable', function()
		{
			var message;
			while((message = this.parser.read()) !== null)
				this.onMessage(message);
		}.bind(this));

		// Channel logic (maintains channel models)
		this.on('join', function(channel)
		{
			if(!(channel in this.channels))
			{
				this.channels[channel] = {
					server: this,
					name: channel,
					topic: '',
					users: [],
					messages: []
				};
			}
		}.bind(this));

		this.on('leave', function(channel)
		{
			delete this.channels[channel];
		}.bind(this));

		var emit_msg = function(prefix, to, message)
		{
			if(to == '*') to = null;

			var msg = {
				timestamp: new Date(),
				from: prefix? prefix.nick : this.nickname,
				text: message
			};

			// Private messages
			if(to in this.channels)
			{
				this.channels[to].messages.push(msg);
			}
			else
			{
				var channel = {
					server: this,
					name: to,
					messages: [msg]
				};

				if(to && to[0] == '#')
				{
					channel.topic = '';
					channel.users = [this.nickname];
				}

				this.channels[to] = channel;
				if(to) this.emit('join', to);
			}
		}.bind(this);

		this.on('notice', emit_msg);
		this.on('message', emit_msg);
		// Simply CTCP action handling
		this.on('ctcp', function(prefix, to, message) {
			if(message.toLowerCase().indexOf('action ') !== 0) return;

			var from = prefix? prefix.nick : this.nickname;
			this.emit('message', {}, to, '* ' + from + ' ' + message.slice(7));
		}.bind(this));
		this.on('motd', function(line) { emit_msg({}, null, '[MOTD] ' + line); });

		this.connect();
		emit_msg({}, null, 'Connecting to ' + this.host + ' on port ' + this.port);
	}

	Server.prototype = Object.create(events.EventEmitter.prototype, {properties: {constructor: Server}});

	Server.prototype.connect = function()
	{
		// Force disconnect (just in case)
		this.disconnect();

		// Create new serialiser/socket
		this.serialiser = new Protocol.Serialiser();
		this.socket = net.createConnection(this.port, this.host);

		// Pipe socket to parser, and serialiser to socket
		this.socket.pipe(this.parser);
		this.serialiser.pipe(this.socket);
		
		// Send initial names
		this.serialiser.write({command: "NICK", parameters: [this.nickname]});
		this.serialiser.write({command: "USER", parameters: [this.username, 0, 0, this.realname]});
	};

	Server.prototype.disconnect = function()
	{
		// Disconnect/destroy serialiser
		if(this.serialiser)
		{
			this.serialiser.end();
			this.serialiser.unpipe(this.socket);
			delete this.serialiser;
		}

		// Disconnect/destroy socket
		if(this.socket)
		{
			this.socket.end();
			this.socket.unpipe(this.parser);
			delete this.socket;
		}

		// Leave all channels
		for(var channel in this.channels)
		{
			this.emit(channel);
		}

		this.channels = {};
	};

	Server.prototype.join = function(channel, password)
	{
		this.serialiser.write({command: "JOIN", parameters: [channel]});
	};

	Server.prototype.leave = function(channel, reason)
	{
		var channel = this.channels[channel];
		if(!channel)
			throw new Error('Server is not a part of that channel!');

		delete this.channels[channel];
		this.serialiser.write({command: "PART", parameters: [channel, reason]});
		this.emit('leave', channel);
	};

	Server.prototype.say = function(to, message)
	{
		this.serialiser.write({command: "PRIVMSG", parameters: [to, message]});
		this.emit('message', null, to, message);
	};

	Server.prototype.notice = function(to, message)
	{
		this.serialiser.write({command: "NOTICE", parameters: [to, message]});
		this.emit('notice', null, to, message);
	};

	Server.prototype.action = function(to, message)
	{
		message = 'ACTION ' + message;
		this.serialiser.write({command: "PRIVMSG", parameters: [to, '\u0001' + message + '\u0001']});
		this.emit('ctcp', null, to, message);
	};

	Server.prototype.onMessage = function(message)
	{
		if (Protocol.Numerics[message.command])
			message.command = Protocol.Numerics[message.command];

		switch(message.command.toLowerCase())
		{
			case 'welcome':
				this.emit('connected');
				break;

			case 'ping':
				this.serialiser.write({command: "PONG", parameters: message.parameters});
				break;

			case 'join':
				var channel = message.parameters[0];
				this.emit('join', channel);
				break;

			case 'part':
				var channel = message.parameters[0];
				this.emit('leave', channel);
				break;

			case 'privmsg':
				var is_ctcp = message.parameters[1][0] === '\u0001' && message.parameters[1][message.parameters[1].length-1] === '\u0001';

				if(is_ctcp)
				{
					this.emit('ctcp', message.prefix, message.parameters[0], message.parameters[1].substr(1, message.parameters[1].length - 2));
				}
				else
				{
					this.emit('message', message.prefix, message.parameters[0], message.parameters[1]);
				}

				break;

			case 'notice':
				this.emit('notice', message.prefix, message.parameters[0], message.parameters[1]);
				break;

			case 'rpl_motd':
				this.emit('motd', message.parameters[1])
				break;

			case 'rpl_list':
				var channel = this.channels[message.parameters[1]];
				channel.topic = message.parameters[3];
				break;

			case 'rpl_notopic':
				var channel = this.channels[message.parameters[1]];
				channel.topic = '';
				break;

			case 'rpl_topic':
				var channel = this.channels[message.parameters[1]];
				channel.topic = message.parameters[2];
				break;

			case 'rpl_namreply':
				var channel = this.channels[message.parameters[2]];
				channel.users = channel.users.concat(message.parameters[3].split(' ')).sort();
				break;
		}

		// TODO: detect user renames
		// TODO: topic changed event
		// TODO: disconnect event & reconnect logic
	};

	return {
		instances: {},
		
		create: function(id, options)
		{
			var instance = this.instances[id];
			if(instance)
				throw new Error('An IRC server with that name already exists!');

			instance = new Server(id, options);
			this.instances[id] = instance;
			return instance;
		}
	};
});