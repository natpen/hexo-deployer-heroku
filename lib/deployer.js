var pathFn = require('path');
var fs = require('hexo-fs');
var chalk = require('chalk');
var swig = require('swig');
var moment = require('moment');
var util = require('hexo-util');
var spawn = util.spawn;

var assetDir = pathFn.join(__dirname, '../assets');

var swigHelpers = {
  now: function(format){
    return moment().format(format);
  }
};

module.exports = function(args){
  var baseDir = this.base_dir;
  var publicDir = this.public_dir;
  var deployDir = pathFn.join(baseDir, '.deploy_heroku');
  var deployPubDir = pathFn.join(deployDir, publicDir.replace(baseDir, ''));
  var log = this.log;
  var message = commitMessage(args);
  var verbose = !args.silent;

  if (!args.repo && !args.repository){
    var help = '';

    help += 'You have to configure the deployment settings in _config.yml first!\n\n';
    help += 'Example:\n';
    help += '  deploy:\n';
    help += '    type: heroku\n';
    help += '    repo: <repository url>\n';
    help += '    message: [message]\n\n';
    help += 'For more help, you can check the docs: ' + chalk.underline('http://hexo.io/docs/deployment.html');

    console.log(help);
    return;
  }

  function git(){
    var len = arguments.length;
    var args = new Array(len);

    for (var i = 0; i < len; i++){
      args[i] = arguments[i];
    }

    return spawn('git', args, {
      cwd: deployDir,
      verbose: verbose
    });
  }

  function setup(){
    // Copy assets
    return fs.copyDir(assetDir, deployDir).then(function(){
      return git('init');
    }).then(function(){
      return git('add', '-A');
    }).then(function(){
      return git('commit', '-m', 'First commit');
    });
  }

  function push(repo){
    return git('add', '-A').then(function(){
      return git('commit', '-m', message).catch(function(){
        // Do nothing. It's OK if nothing to commit.
      });
    }).then(function(){
      return git('push', '-u', repo, 'master', '--force');
    });
  }

  return fs.exists(deployDir).then(function(exist){
    if (exist) return;

    log.info('Setting up Heroku deployment...');
    return setup();
  }).then(function(){
    return fs.exists(deployPubDir);
  }).then(function(exist){
    if (!exist) return;

    log.info('Clearing .deploy folder...');
    return fs.emptyDir(deployPubDir);
  }).then(function(){
    log.info('Copying files from public folder...');
    return fs.copyDir(publicDir, deployPubDir);
  }).then(function(){
    return push(args.repo || args.repository);
  });
};

function commitMessage(args){
  var message = args.m || args.msg || args.message || 'Site updated: {{ now(\'YYYY-MM-DD HH:mm:ss\') }}';
  return swig.compile(message)(swigHelpers);
}