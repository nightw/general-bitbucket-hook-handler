/*
Please note, that this configuration file is only a template.
You have to rename it to config.js for the application to use it.
And you will most likely need to edit the defaults to make it work for your
specific use-case
*/
var config = {
  apps: {
    yourapp: {
      branches_to_track: {
        master: {
          command_to_run: "cd /var/yourapp; git fetch; git checkout -f; <some_restart_command>"
        },
        test: {
          command_to_run: "cd /var/yourapp_test_install; git fetch; git checkout -f; <some_restart_command>"
        }
      }
    },
    "your-other-app": {
      branches_to_track: {
        master: {
          command_to_run: "cd /var/your-other-app; git fetch; git checkout -f; <some_restart_command>"
        },
        "test-branch": {
          command_to_run: "cd /var/your-other-app-test-install; git fetch; git checkout -f; <some_restart_command>"
        }
      }
    }
  },
  retries: 5,
  // this is in milliseconds!
  command_timeout: 120000,
  logfile: "./general-bitbucket-hook-handler.log",
  debug: false,
  port: 38889
};
module.exports = config;
