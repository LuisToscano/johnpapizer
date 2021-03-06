const http = require('http');
const antlr4 = require('antlr4/index');
const ECMAScriptLexer = require('./grammar/ECMAScriptLexer');
const ECMAScriptParser = require('./grammar/ECMAScriptParser');
const ECMAListener = require('./ECMAListener').ECMAListener;
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const utils = require('./core/utils').utils;
const chalk = require('chalk');
const Promise = require('promise');
const red = chalk.red;
const green = chalk.green;
const white = chalk.white;
const cyan = chalk.cyan;
const yellow = chalk.yellow;

const TAB = '\t';
const LINE_BREAK = '\n';
const CONFIG_FILE = 'papa.config'

exports.johnpapizer = johnpapizer;
var config = {};

function johnpapizer() {
    var url = path.resolve(process.cwd(), './' + CONFIG_FILE);
    console.log(LINE_BREAK);
    console.log('Veryfing AngularJS Implementation according to John Papa\'s style guide ...');
    console.log(white.bold('For more information go to: ') + 'https://github.com/johnpapa/angular-styleguide/blob/master/a1/README.md' + LINE_BREAK);
    return new Promise (function(resolve, reject) {
        fs.readFile(url,'utf8', function(err, data) {
            if(err) {
                console.log(red.bold('missing configuration file: '), url);
                reject(err);
            }
            config = JSON.parse(data);
            var angularUrl = path.resolve(process.cwd(), './' + config.url);
            validateFiles(angularUrl)
            .then(function(resp) {
                if(!resp){
                    console.log(green.bold(LINE_BREAK + '0 errors'));
                }
                resolve(resp);
            })
            .catch(function(err) {
                reject(err);
            });
        });
    });
}

function validateFiles(dir) {
    return new Promise (function(resolve, reject){
        var isError = false;
        listAllFiles(dir)
        .then(function(files) {
            var promises = [];
            _.forEach(files, function(file) {
                promises.push(new Promise(function(resolvep, rejectp){
                    fs.readFile(file, 'utf8', function(err, data){
                        if(err) { rejectp(err) }
                        resolvep(validateFile(data, file, utils.getAngularMethod(file)));
                    });
                }));
             });

            Promise.all(promises)
            .then(function(values) {
                resolve(_.indexOf(values, true) >= 0);
            })
            .catch(function(err) {
                reject(err);
            });
        })
        .catch(function(err) {
            reject(err);
        });
    });
};

function listAllFiles(dir) {
    return new Promise(function(resolve, reject){
        fs.readdir(dir, function(err, list){
            if(err){
                throw err;
            }
            var files = [];
            var promises = [];
            _.forEach(list, function(file) {
                var fn = dir + '\\' + file;
                var stat = fs.statSync(fn);
                if (stat.isDirectory()){
                    promises.push(listAllFiles(fn));
                } else {
                    var method = utils.getAngularMethod(file);
                    if (file.endsWith('.js') && !file.endsWith('spec.js') &&
                        !file.endsWith('min.js') && method !== null && !inIgnore(file)) {
                        files.push(fn);
                    }
                }
            });

            Promise.all(promises)
            .then(function(values) {
                _.forEach(values, function(value) {
                    files = _.concat(files, value);
                });
                resolve(files);
            })
            .catch(function(err) {
                reject(err);
            })
        });
    });
}

function validateFile(input, file, method) {
   var chars = new antlr4.InputStream(input);
   var lexer = new ECMAScriptLexer.ECMAScriptLexer(chars);
   var tokens  = new antlr4.CommonTokenStream(lexer);
   var parser = new ECMAScriptParser.ECMAScriptParser(tokens);
   parser.buildParseTrees = true;   
   var tree = parser.program();   
   var htmlECMAScript = new ECMAListener(tokens);
   antlr4.tree.ParseTreeWalker.DEFAULT.walk(htmlECMAScript, tree);

   if(method === 'controller'){
       if(htmlECMAScript.resp.httpUsed) {
            htmlECMAScript.resp.errors.push(htmlECMAScript.resp.httpUsed);
       }

       if(!htmlECMAScript.resp.vmUsed) {
            htmlECMAScript.resp.errors.push({
                title: utils.getMessages().noVmInController.title,
                message: utils.getMessages().noVmInController.body,
                hint: utils.getMessages().noVmInController.hint,
                why:  utils.getMessages().noVmInController.why
            });
       }
   }

   if (method === 'directive') {
       if (htmlECMAScript.resp.restrictEA) {
            htmlECMAScript.resp.errors.push(htmlECMAScript.resp.restrictEA);
       }

        if(!htmlECMAScript.resp.controllerAsVM) {
            htmlECMAScript.resp.errors.push({
                title: utils.getMessages().noVmInRoute.title,
                message: utils.getMessages().noVmInRoute.body,
                hint: utils.getMessages().noVmInRoute.hint,
                why: utils.getMessages().noVmInRoute.why
            });
       }

        if(!htmlECMAScript.resp.bindToController) {
            htmlECMAScript.resp.errors.push({
                title: utils.getMessages().scopeNotBoundToController.title,
                message: utils.getMessages().scopeNotBoundToController.body,
                hint: utils.getMessages().scopeNotBoundToController.hint,
                why: utils.getMessages().scopeNotBoundToController.why
            });
       }
   }

   if (method === 'route') {
       if(!htmlECMAScript.resp.controllerAsVM) {
            htmlECMAScript.resp.errors.push({
                title: utils.getMessages().noVmInRoute.title,
                message: utils.getMessages().noVmInRoute.body,
                hint: utils.getMessages().noVmInRoute.hint,
                why: utils.getMessages().noVmInRoute.why
            });
       }
   }

   if (htmlECMAScript.resp.errors.length === 0) {
       console.log(green(file));
   }else {
       console.log(LINE_BREAK + TAB + red.bold(file));
       console.log(TAB + red.bold(htmlECMAScript.resp.errors.length + ' errors.' + LINE_BREAK));
   }

   htmlECMAScript.resp.errors.forEach( function(error) {
       if (error.title) {
        console.log(TAB + yellow.bold(error.title));
       }
       if (error.line && error.body) {
        console.log(TAB + yellow.bold('line: '+ error.line) + '. ' + white.bold(error.body));
       }
       console.log(TAB + cyan.bold(error.message));
       console.log(TAB + cyan.bold(error.hint));
       console.log(LINE_BREAK);
       if(error.why && error.why.length > 0) {
           console.log(TAB + white.bold('Why?'));
           _.forEach(error.why, function(w){
                console.log(TAB + w);
           })
           console.log(LINE_BREAK);
       }
   }, this);

   return htmlECMAScript.resp.errors.length > 0;
}

function inIgnore(file) {
    if (config.ignore && Array.isArray(config.ignore) && config.ignore.length > 0) {
        return _.indexOf(config.ignore, file) >= 0;
    } else{
        return false;
    }
}