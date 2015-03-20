angular.module('IRC')
.controller('CommandCtrl', [
	'$scope',
	function($scope)
	{
		$scope.processCommand = function()
		{
			var cmd = $scope.command;
			$scope.command = '';

			var channel = $scope.$parent.channels[$scope.$parent.current_channel];
			var server = channel.server;

			if(cmd[0] == '/')
			{
				var parts = cmd.split(' ');

				switch(parts[0])
				{
					case '/join':
						if(!server)
						{
							alert('Not active server connection!');
						}
						else if(parts.length < 2)
						{
							server.addMessage(server.name + '-', 'Usage: /join #channel (#password)', 'error');
						}
						else
						{
							server.join(parts[1], parts.length > 2? parts[2] : '', function(error)
							{
								alert(error);
							});
						}
						break;

					case '/leave':
						if(!server)
						{
							alert('Not active server connection!');
						}
						else if(!channel_name)
						{
							server.addMessage('Not active channel!', 'error');
						}
						else
						{
							server.part(channel_name, parts.length > 1? parts[1] : '');
						}
						break;

					case '/connect':
						// TODO: server.connect();
						break;

					case '/disconnect':
						if(server) server.disconnect();
						else
						{
							// TODO: error
						}
						break;

					case '/me':
						if(channel) server.action(channel.name, parts.slice(1).join(' '));
						else
						{
							// TODO: error
						}
						break;
				}
			}
			else if(channel)
			{
				server.say(channel.name, cmd);
			}
		};
	}
]);