# general-bitbucket-hook-handler

This is a simple, standalone NodeJS service which is capable of handling any [BitBucket](https://bitbucket.org) POST hook and run (local) commands based on the contents of them. It looks for specific data in the POST body and if it found the applications which are configured then runs the given commands on the local machine.

It's meant to be used as an automatic update mechanism for test systems of the code in your BitBucket repository (if somebody pushes some code to one of the "tracked" BitBucket repositories, then the test system updates the locally running version of the project automatically using the POST hook data from BitBucket).

But of course you can run any arbitrary command you want (e.g. e-mailing some list, run some CI actions on your local Jenkins, etc.) when a commit is pushed to one of the "tracked" repositories.

Also one instance of this application can track any amount of repositories.

## How it works

It listens for POST requests looking for the `payload` variable in them and expecting to find JSON date in them (provided in the BitBucket format). If the incoming data is right, then it looks for the application names and the given branch(es) in it and if they're found then runs the given commands for that specific application and branch combination.

## Installation

### Prerequisites

* `Node.js` (e.g. from [here](http://nodejs.org/) if you do not have it yet)
* `git`

### Actual install

1. Check out this repository: `git clone http://github.com/nightw/general-bitbucket-hook-handler.git`
1. Install the dependencies: `npm install`
1. Make a copy of the `config.example.js` file to `config.js` and edit to suit your needs (more details in the Usage section):
1. Run it with `npm start`
1. Add a BitBucket POST hook using [this guide](https://confluence.atlassian.com/display/BITBUCKET/POST+hook+management) with the public URL of the previously started Node process (e.g. `http://your-domain.tld:38889/`)

## Usage

### config.js file

**TL;DR:** There is an example config file in this repository on the name of `config.example.js`. You can copy it to `config.js` and just change the values yourself (it's easy to guess which one does what).

The following variables are supported in the config file:

* `apps`, type: Object, default value: `null`
  * This contans the repository short names (or `slug`s) and the branches in them which which you want to "track"
  * And also the command to run when there is a change in the specific repository's specific branch
  * The format can be seen in the `config.example.js` file
* `retries`, type: Integer, default value: 5
   * The number which tells how many times do you want to retry the local commands automatically if the return value of them was not `0`
* `command_timeout`, type: Integer, default value: `120`
   * The amount of time you want to wait for the given command to finish before you terminate it and try again (if there is any retries left, see previous option)
* `logfile`, type: String, default value: `./general-bitbucket-hook-handler.log`
   * If `debug` config variable is false, then this file will contain the log entries from the application
* `debug`, type: Boolean, default value: `false`,
   * If it's true then the application will output all of the messages to the console instead of the file given in the `logfile` configuration option
* `port`, type: Integer, default value: `38889`
   * The TCP port on which the application will listen on

### Environment variables

All of the `config.js` variables (except for the `apps`) can be overriden using Environment variables. The names must be the same, but written using UPPERCASE.

For example to override `logfile` config variables you should do this before running the app: `export LOGFILE=./foobar.log`

### The required POST data format

You should not care about it, since it should be generated and used by BitBucket automatically, but anyway here is an example I found [here](https://confluence.atlassian.com/display/BITBUCKET/POST+hook+management):

```
{
    "canon_url": "https://bitbucket.org",
    "commits": [
        {
            "author": "marcus",
            "branch": "master",
            "files": [
                {
                    "file": "somefile.py",
                    "type": "modified"
                }
            ],
            "message": "Added some more things to somefile.py\n",
            "node": "620ade18607a",
            "parents": [
                "702c70160afc"
            ],
            "raw_author": "Marcus Bertrand <marcus@somedomain.com>",
            "raw_node": "620ade18607ac42d872b568bb92acaa9a28620e9",
            "revision": null,
            "size": -1,
            "timestamp": "2012-05-30 05:58:56",
            "utctimestamp": "2012-05-30 03:58:56+00:00"
        }
    ],
    "repository": {
        "absolute_url": "/marcus/project-x/",
        "fork": false,
        "is_private": true,
        "name": "Project X",
        "owner": "marcus",
        "scm": "git",
        "slug": "project-x",
        "website": "https://atlassian.com/"
    },
    "user": "marcus"
}
```

## Motivation

I wanted to have a test system for some of our projects which automatically updates the and runs the latest code from our repositories at BitBucket. And doing `git pull` every minute with cron is obviously a bad solution for that. I searched for a good BitBucket hook handler example, but only found some example ones written in PHP (not easy to read, a bit of hassle to run (for only this purpose), etc.). And even they were not so general (only doing something with a given repository, no multi-branch handling and no general configurability). So I decided to write my own general BitBucket hook handler and that's it. :)

I've chosen Node.js, because I wanted to learn more about it. This is my second project written with it, so I welcome suggestions and fixes about not just this project itself, but general Node.js things too. :)

## Contributing

1. Fork it!
1. Create your feature branch: `git checkout -b my-new-feature`
1. Commit your changes: `git commit -am 'Add some feature'`
1. Push to the branch: `git push origin my-new-feature`
1. Submit a pull request :)

## History

0.1.0 - First version released

## Credits

* Thanks **again** for [Andras Ivanyi](https://github.com/andyskw) for helping with Node.js learning and reviewing the first version

## License

Code released under [the MIT license](LICENSE)
