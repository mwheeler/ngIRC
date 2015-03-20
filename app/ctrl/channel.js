// FIXME: This controller is currently useless, and completely disconnected from server.channels - server.channels should point to controllers, instead of being a separate model maintained by Server
// - ChannelCtrl should maintain it's own model (instead of Server doing it internally, server should just deal w/ networking/protocol and raise/send events)

angular.module('IRC')
.controller('ChannelCtrl', [
	'$scope', '$element',
	function($scope, $element)
	{
		$scope.users = $scope.users || [];
		$scope.messages = $scope.messages || []; // {timestamp:Date, from:string, text:string}

		$scope.say = function(msg)
		{
			$scope.server.say($scope.name, msg);
		}

		$scope.notice = function(msg)
		{
			$scope.server.notice($scope.name, msg);
		}

		$scope.leave = function(msg)
		{
			$scope.server.leave($scope.name, msg);
		}

		var scrollToBottom = function()
		{
			$element.scrollTop($element.scrollHeight);
		}.bind(this);

		$scope.$watchCollection('messages', scrollToBottom);
	}
]);