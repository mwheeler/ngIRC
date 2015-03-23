var path = require('path');
var gulp = require('gulp');
var jeditor = require("gulp-json-editor");
var NwBuilder = require('node-webkit-builder');
var Promise = require('bluebird');

var config = {
	dir: {
		build: './build',
		dist: './dist'
	}
}

gulp.task('install-dependencies', function()
{
	var tasks = [];

	tasks.push(new Promise(function(pass, fail)
	{
		gulp.src('node_modules/jquery/dist/jquery.min.js')
			.pipe(gulp.dest(path.join(config.dir.build, 'js')))
			.on('error', fail)
			.on('end', pass);
	}));

	tasks.push(new Promise(function(pass, fail)
	{
		gulp.src('node_modules/angular/angular.js')
			.pipe(gulp.dest(path.join(config.dir.build, 'js')))
			.on('error', fail)
			.on('end', pass);
	}));

	tasks.push(new Promise(function(pass, fail)
	{
		gulp.src('node_modules/irc-protocol/**/*')
			.pipe(gulp.dest(path.join(config.dir.build, 'node_modules', 'irc-protocol')))
			.on('error', fail)
			.on('end', pass);
	}));

	tasks.push(new Promise(function(pass, fail)
	{
		gulp.src('node_modules/bluebird/**/*')
			.pipe(gulp.dest(path.join(config.dir.build, 'node_modules', 'bluebird')))
			.on('error', fail)
			.on('end', pass);
	}));

	return Promise.all(tasks);
});

gulp.task('build', function(cb)
{
	var tasks = [];

	tasks.push(new Promise(function(pass, fail)
	{
		gulp.src('app/**/*')
			.pipe(gulp.dest(config.dir.build))
			.on('error', fail)
			.on('end', pass);
	}));

	tasks.push(new Promise(function(pass, fail)
	{
		gulp.src('package.json')
			.pipe(jeditor({
				// Remove dev properties
				scripts: undefined,
				dependencies: undefined,
				devDependencies: undefined,
				// Add NW.js properties
				main: 'index.html',
				window: {
					frame: false,
					toolbar: true, // Only for debugging, disable for release
					width: 1280,
					height: 720
				}
			}))
			.pipe(gulp.dest(config.dir.build))
			.on('error', fail)
			.on('end', pass);
	}));

	return Promise.all(tasks);
});

gulp.task('package', ['install-dependencies', 'build'], function()
{
	var nw = new NwBuilder({
	    files: path.join(config.dir.build, '**', '**'),
	    buildDir: config.dir.dist,
	    platforms: ['win32']
	    //platforms: ['osx32', 'osx64', 'win32', 'win64']
	});

	nw.on('log', console.log);

	return nw.build();
})

gulp.task('default', ['install-dependencies', 'build', 'package']);