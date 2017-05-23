const antlr4 = require('antlr4/index');
const ECMAScriptLexer = require('./grammar/ECMAScriptLexer');
const ECMAScriptParser = require('./grammar/ECMAScriptParser');
var sprintf = require('sprintf');
var ECMAScriptListener = require('./grammar/ECMAScriptListener').ECMAScriptListener;
var utils = require('./core/utils').utils;
var _ = require('lodash');

var messages = utils.getMessages();

ECMAListener = function(tokenStream) {
    this.tokenStream = tokenStream;
    this.resp = {
        errors: [],
        vmUsed: false,
        httpUsed: false,
        controllerAsVM: false,
        restrictEA: false,
        bindToController: false
    };
    ECMAScriptListener.call(this); // inherit default listener
    return this;
};

// inherit default listener
ECMAListener.prototype = Object.create(ECMAScriptListener.prototype);
ECMAListener.prototype.constructor = ECMAListener;

ECMAScriptListener.prototype.enterMemberDotExpression = function(ctx) {
    
    var singleExp = ctx.singleExpression().getText();
    var identifier = ctx.identifierName().getText();

    if(singleExp.startsWith('$scope') && !identifier.startsWith('$')) {
        this.resp.errors.push(utils.buildError(ctx, this.tokenStream, messages.setScopeVar.body,
        sprintf(messages.setScopeVar.hint, {
            id: identifier
        }),
        messages.setScopeVar.why
        ));
    }

    if(singleExp.startsWith('$http')) {
        this.resp.httpUsed = utils.buildError(ctx, this.tokenStream, messages.httpInController.body,
        messages.httpInController.hint,  messages.httpInController.why);
    }
};

ECMAScriptListener.prototype.enterArgumentList = function(ctx) {
    
    var parentTxt = ctx.parentCtx.parentCtx.getText();
    var singleExp = ctx.parentCtx.parentCtx.singleExpression().getText();
    var method = utils.getAngularMethod(singleExp);

    var idx = ctx.getText().indexOf('function(');
    if (idx >= 0) {
        var subStr = ctx.getText().substring(idx, ctx.getText().lastIndexOf('}') + 1);
        this.resp.errors.push(utils.buildError(ctx.parentCtx.parentCtx, this.tokenStream,
        messages.namedFunctions.body, sprintf(messages.namedFunctions.hint, {
            parent: parentTxt.replace(subStr, 'myNamedFunction')
        }),
        messages.namedFunctions.why
        ));
    }

    if(!parentTxt.startsWith('angular.') && method){
        if(singleExp.indexOf('module(') && method !== 'module'){
            var modules = singleExp.substring(singleExp.indexOf('module(') + 7, singleExp.indexOf(')'));
            method = 'module('+ modules + ').' + method;
        }

        this.resp.errors.push(utils.buildError(ctx.parentCtx.parentCtx, this.tokenStream,
        messages.getAngularFromVar.body, sprintf(messages.getAngularFromVar.hint, {
            method: method,
            wrong: singleExp
        }),
        messages.getAngularFromVar.why
        ));
    }

    if(method !== null) {
        var param = ctx.getText().substring(ctx.getText().indexOf(',') + 1);
        if(param.startsWith('[') && param.endsWith(']') && method !== 'module') {
            var args = param.replace('[','').replace(']').split('\'');
            var strArgs = '';
            
            _.remove(args, function(arg) {
               return _.indexOf(args, arg) % 2 === 0;
            });

            _.forEach(args, function(arg){
                strArgs += '\'' + arg + '\', ';
            })

            this.resp.errors.push(utils.buildError(ctx.parentCtx.parentCtx, this.tokenStream,
            messages.inLineDependencies.body, sprintf(messages.inLineDependencies.hint, {
                method: method,
                args: strArgs
            }),
            messages.inLineDependencies.why
            ));
        }
    }
};

ECMAScriptListener.prototype.enterPropertyExpressionAssignment = function(ctx) {
    
    if(ctx.propertyName().getText() === 'controllerAs' && ctx.singleExpression().getText() === '\'vm\''){
        this.resp.controllerAsVM = true;
    }

    if(ctx.propertyName().getText() === 'bindToController' && ctx.singleExpression().getText() === 'true'){
        this.resp.bindToController = true;
    }

    if(ctx.propertyName().getText() === 'restrict' && (ctx.singleExpression().getText() !== '\'E\'' && ctx.singleExpression().getText() !== '\'EA\'')) {
        this.resp.restrictEA =  utils.buildError(ctx, this.tokenStream, messages.noEAInDirective.body,
        sprintf(messages.noEAInDirective.hint, {
            wrong: ctx.singleExpression().getText()
        }), messages.noEAInDirective.why);
    }

    if (ctx.singleExpression().getText().startsWith('function')) {
        this.resp.errors.push(utils.buildError(ctx, this.tokenStream, messages.setFunctionToVar.body,
        sprintf(messages.setFunctionToVar.hint, {
            id: ctx.propertyName().getText()
        }),
        messages.setFunctionToVar.why
        ));
    }
};

ECMAScriptListener.prototype.enterAssignmentExpression = function(ctx) {
    
    var expressionSequence = ctx.expressionSequence().getText();
    var singleExpression = ctx.singleExpression().getText();
    var method = utils.getAngularMethod(expressionSequence);

    if (expressionSequence.startsWith('function')) {
        this.resp.errors.push(utils.buildError(ctx, this.tokenStream, messages.setFunctionToVar.body,
        sprintf(messages.setFunctionToVar.hint, {
            id: singleExpression
        }),
        messages.setFunctionToVar.why
        ));
    }

    if (singleExpression.startsWith('this.')) {
        this.resp.errors.push(utils.buildError(ctx, this.tokenStream, messages.noVmInController.body,
        messages.noVmInController.hint,messages.noVmInController.why));
    }
};

ECMAScriptListener.prototype.enterVariableDeclaration = function(ctx) {
    var identifier = ctx.Identifier().getText();
    var initialiser = ctx.initialiser().getText();
    var method = utils.getAngularMethod(initialiser);

    if (initialiser.startsWith('=angular.') && method !== null) {
        this.resp.errors.push(utils.buildError(ctx, this.tokenStream, messages.setAngularToVar.body,
        sprintf(messages.setAngularToVar.hint, {
            method: utils.getAngularMethod(ctx.getText()),
            wrong: initialiser
        }),
        messages.setAngularToVar.why
        ));
    }

    if(identifier === 'vm' && initialiser.indexOf('this') >= 0) {
        this.resp.vmUsed = true;
    }

    if (initialiser.startsWith('=function')) {
        this.resp.errors.push(utils.buildError(ctx, this.tokenStream, messages.setFunctionToVar.body,
        sprintf(messages.setFunctionToVar.hint, {
            id: identifier
        }),
        messages.setFunctionToVar.why
        ));
    }
};

exports.ECMAListener = ECMAListener;
