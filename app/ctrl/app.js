angular.module('IRC')
.controller('Client', [
	'$scope', 'Server',
	function($scope, Server)
	{
		var default_name = 'Guest-' + Math.round(Math.random()*10000);
		$scope.default_nickname = default_name;
		$scope.default_username = default_name;
		$scope.default_realname = '';

		$scope.current_channel = null;	// The active channel (ID)
		$scope.servers = {};			// All servers keyed by server name
		$scope.channels = {};			// All channels (across all servers) keyed by ID ({{server.name}}-{{channel.name}})

		$scope.setChannel = function(id)
		{
			$scope.current_channel = id;
		}

		$scope.config = function(path)
		{
			// TODO: load configuration file

			var server = this.connect('FreeNode', 'irc.freenode.net', 6667, "ngIRC_TEST", "ngIRC-Client", "ngIRC Client");
			server.on('join', function(channel) { this.channels[server.name + '-' + channel.name] = channel; });
			server.on('leave', function(channel) { delete this.channels[server.name + '-' + channel.name]; });
		};

		// Connect to a server
		$scope.connect = function(id, host, port, nickname, username, realname, password)
		{
			// Validate inputs
			if(nickname.indexOf(' ') !== -1)
				throw new Error('nickname may not contain spaces!');

			if(username.indexOf(' ') !== -1)
				throw new Error('username may not contain spaces!');

			// Create server
			var server = Server.create(id, {
				host: host,
				port: port,
				password: password,
				nickname: nickname || $scope.default_nickname,
				username: username || $scope.default_username,
				realname: realname || $scope.default_realname
			});

			// Maintain model on join/part
			server.on('join', function(channel)
			{
				var id = server.name + '-' + channel;
				$scope.channels[id] = server.channels[channel];
				if(!$scope.current_channel) $scope.current_channel = id;
				$scope.$apply();
			});

			server.on('leave', function(channel)
			{
				var id = server.name + '-' + channel;
				delete $scope.channels[id];
				if($scope.current_channel == id) $scope.current_channel = null;
				$scope.$apply();
			});

			$scope.safeApply = function() {
			  var phase = this.$root.$$phase;
			  if(phase != '$apply' && phase != '$digest') {
			    this.$apply();
			  }
			};

			// FIXME: All these should be on a channel-controller basis (not application controller)
			server.on('ctcp', $scope.safeApply.bind($scope));
			server.on('message', $scope.safeApply.bind($scope));
			server.on('notice', $scope.safeApply.bind($scope));
			server.on('motd', $scope.safeApply.bind($scope));

			$scope.servers[id] = server;
			$scope.channels[id] = server.channels[null];
			$scope.current_channel = id;
			return server;
		};

		// Disconnect from a server
		$scope.disconnect = function(id)
		{
			var server = $scope.servers[id];
			server.disconnect();
			delete $scope.servers[id];
		};
	}
]);