#!/usr/bin/env node

var http = require('http');
var Q = require('q');
var fs = require('fs');
var exec = require('child_process').exec;
var querystring = require('querystring');

var config = require('./config');

function log(message, add_newline_to_log_file_entry) {
  if (typeof add_newline_to_log_file_entry !== "undefined" && add_newline_to_log_file_entry === false) {
    var newline_char = "";
  } else {
    var newline_char = "\n";
  }
  if (config.debug) {
    console.log(message);
  } else if (config.logfile != null) {
    // Add date to the log file using the usual syslog format
    // And yes, I do NOT want to include a dependency for this
    // BTW I love you Javascript:
    // http://swizec.com/blog/javascripts-lack-of-strftime/swizec/3164
    var syslog_datestr = new Date().toString().replace(/^\w+ /, '').replace(/\d{4} /, '').replace(/ GMT.*$/, '');
    fs.appendFile(config.logfile, syslog_datestr + " " + message + newline_char, function (err) {
      if (err) throw err;
    });
  }
}

function env_parse(options) {
  if (options["variable_name"] === undefined) {
    throw new Error("'variable_name' option in the options object must be set for env_parse function!");
  }
  if (options["variable_type"] === "boolean") {
    if (process.env[options["variable_name"].toUpperCase()] !== undefined && (process.env[options["variable_name"].toUpperCase()] == "true" || process.env[options["variable_name"].toUpperCase()] == "1")) {
      config[options["variable_name"]] = true;
    } else if (process.env[options["variable_name"].toUpperCase()] !== undefined && (process.env[options["variable_name"].toUpperCase()] == "false" || process.env[options["variable_name"].toUpperCase()] == "0")) {
      config[options["variable_name"]] = false;
    } else if (config[options["variable_name"]] === undefined) {
      config[options["variable_name"]] = options["default_value"];
    }
  } else if (options["variable_type"] === "integer") {
    if (process.env[options["variable_name"].toUpperCase()] !== undefined) {
      config[options["variable_name"]] = parseInt(process.env[options["variable_name"].toUpperCase()]);
    } else if (config[options["variable_name"]] === undefined) {
      config[options["variable_name"]] = options["default_value"];
    }
    if (config[options["variable_name"]] !== parseInt(config[options["variable_name"]])) {
      throw new Error(options["variable_name"] + " variable (either in ENV or in config.js) is set to an invalid value (not an integer)");
    }
  } else {
    if (process.env[options["variable_name"].toUpperCase()] !== undefined) {
      config[options["variable_name"]] = process.env[options["variable_name"].toUpperCase()];
    } else if (config[options["variable_name"]] === undefined) {
      config[options["variable_name"]] = options["default_value"];
    }
  }
}

function process_post(raw_post) {
  var deferred = Q.defer();

  var commands_to_run = {};
  var post;

  try {
    post = JSON.parse(querystring.parse(raw_post).payload);
  } catch (e) {
    log("Cannot parse incoming POST data as JSON: " + e);
    deferred.reject("Cannot parse incoming hook post data as JSON!");
    return deferred.promise;
  }

  if (post == null || Object.keys(post).length === 0) {
    log("Incoming POST JSON is null or empty!");
    deferred.reject("Incoming POST JSON is null or empty!");
    return deferred.promise;
  }

  // Checking for matching app slug in the config
  for (var app in config.apps) {
    var update = false;
    commands_to_run[app] = [];
    if (post.repository == null || post.repository.slug == null) {
      log("The incoming hook post data does not contain the needed repository information (e.g. slug name)!")
      deferred.reject("The incoming hook post data does not contain the needed repository information (e.g. slug name)!");
      return deferred.promise;
    }
    if (post.repository.slug == app) {
      log("FOUND " + app + " app in the POST data, which is tracked, so checking for matching branch...")
      for (var branch_to_track in config.apps[app].branches_to_track) {
        if (post.commits == null || post.commits.length == 0) {
          log("UPDATE for " + app + " will be done to be sure because the commits array is empty in the received POST data.");
          commands_to_run[app].push(config.apps[app].branches_to_track[branch_to_track].command_to_run);
          update = true;
        } else {
          for (index = 0; index < post.commits.length; ++index) {
            if (post.commits[index].branch == branch_to_track) {
              log("UPDATE for " + app + " will be done because there was at least one commit received in the POST data which matches the trecked branch: " + branch_to_track);
              commands_to_run[app].push(config.apps[app].branches_to_track[branch_to_track].command_to_run);
              update = true;
            }
          }
        }
      }
    }
    if (!update) {
      log("NO UPDATE for " + app + ", because there was no commits in the received POST data, which matches any tracked branch.");
    }
  }

  deferred.resolve(commands_to_run);

  return deferred.promise;
}

function do_exec(command, app_name, retry_left) {
  exec(command, {timeout: config.command_timeout}, function command_done_callback(error, stdout, stderr) {
    if (error !== null) {
      log('UPDATE FAILED (retries left: ' + (retry_left - 1) + ') for ' + app_name + ':');
      log("\t command: '" + command + "'");
      log("\t\t exit code: " + error.code);
      // if stdout or stderr don't have a newline at the end (they usually have
      // if they're not empty), then we add one if the log goes to file
      log("\t\t stdout: " + stdout, /\n$/.test(stdout) ? false : true);
      log("\t\t stderr: " + stderr, /\n$/.test(stderr) ? false : true);
      if (retry_left - 1 > 0) {
        do_exec(command, app_name, retry_left - 1);
      }
    } else {
      log('UPDATE SUCCESS for ' + app_name + '!');
    }
  });
}


function run_commands(commands_to_run) {
  for (var current_app in commands_to_run) {
    for (index = 0; index < commands_to_run[current_app].length; ++index) {
      do_exec(commands_to_run[current_app], current_app, config.retries);
    }
  }
}

var server = http.createServer(function(req, res) {
  if (req.method == 'POST') {
    var body = '';
    req.on('data', function (data) {
      body += data;

      // Too much POST data, send a too long HTTP status code
      if (body.length > 1e6) {
        res.statusCode = 413;
        res.end("Request Entity Too Large");
        req.connection.destroy();
      }
    });
    req.on('end', function () {

      process_post(body).then(
        function process_post_success(commands_to_run) {
          run_commands(commands_to_run);
          res.statusCode = 200;
          res.end("OK");
        },
        function process_post_error_handler(err) {
          res.statusCode = 500;
          res.end(err);
        }
      );

    });
  } else {
    res.statusCode = 405;
    res.end("Method Not Allowed. Only POST is accepted");
  }
});

function init(callback) {
  // Global config variables used accross the whole application
  // Their value is coming from the following places: if their uppercase version
  // 1. If their uppercase version is not null in ENV variables, then use that
  // 2. If the same name key in config.js is not null, then use that
  // 3. If none of the above use the default_value from the options Object
  try {
    env_parse({variable_name: "debug", variable_type: "boolean", default_value: false});
    env_parse({variable_name: "logfile", variable_type: "string", default_value: "./general-bitbucket-hook-handler.log"});
    env_parse({variable_name: "retries", variable_type: "integer", default_value: 5});
    env_parse({variable_name: "command_timeout", variable_type: "integer", default_value: 120});
    env_parse({variable_name: "port", variable_type: "integer", default_value: 38889});
    callback(null, config.port);
  } catch(err) {
    callback(err);
  }
}

init(function start(err, port){
  if (err) {
    console.error("Error during starting the app: " + err.message);
    process.exit(1);
  } else {
    server.listen(port);
  }
});
