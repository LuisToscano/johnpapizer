var _ = require('lodash');

var utils = {
    getAngularMethod: getAngularMethod,
    buildError: buildError,
    getMessages: getMessages
}


var angular_reserved_methods = ['controller', 'factory', 'provider', 'service', 'directive'];

function getAngularMethod(str) {
    var angularMethod = null
    _.forEach(angular_reserved_methods, function(reserved) {
        if(str.indexOf('.' + reserved) >= 0) {
            angularMethod = reserved;
            return;
        }
    });

    if(angularMethod === null && str.indexOf('.module') >= 0) {
        angularMethod = 'module';
    }
    return angularMethod;
}

function buildError(ctx, tokenStream, message, hint) {
     var token = tokenStream.get(ctx.getSourceInterval().start);
     return {
        message: message,
        line: token.line,
        col:  token.column,
        body: ctx.getText(),
        hint: hint
     };
}

function getMessages() {
    return {
        setAngularToVar: {
            body: 'Avoid declaring angular components into variables',
            hint: 'Use angular.%(method)s() instead of %(wrong)s.%(method)s()',
            why: ['This produces more readable code and avoids variable collisions or leaks']
        },
        getAngularFromVar: {
            body: 'Avoid using a variable and instead use chaining with the getter syntax',
            hint: 'Use angular.%(method)s instead of %(wrong)s',
            why: ['This produces more readable code and avoids variable collisions or leaks']
        },
        setFunctionToVar: {
            body: 'Avoid saving functions to variables directly',
            hint: 'Define them below the bindable members instead -> var %(id)s = myFunction; . . . function myFunction() {}',
            why: ['Placing the implementation details of a function later in the file moves that complexity out of view so you can see the important stuff up top',
                  'Placing bindable members at the top makes it easy to read and helps you instantly identify which members of the controller can be bound and used in the View',
                  '']
        },
        setScopeVar: {
            body: 'Avoid saving values into $scope service',
            hint: 'Use controllerAs syntax instead -> vm.%(id)s = ... ;',
            why: ['It promotes the use of binding to a "dotted" object in the View (e.g. customer.name instead of name), which is more contextual, easier to read, and avoids any reference issues that may occur without "dotting"',
                  'Helps avoid using $parent calls in Views with nested controllers',
                  ' Helps avoid the temptation of using $scope methods inside a controller when it may otherwise be better to avoid them or move the method to a factory, and reference them from the controller']
        },
        namedFunctions: {
            body: 'Avoid passing an anonymous function as a callback',
            hint: 'Use named functions instead -> %(parent)s . . . myNamedFunction() {}',
            why: ['This produces more readable code, is much easier to debug, and reduces the amount of nested callback code']
        },
        inLineDependencies: {
            body: 'Avoid creating in-line dependencies as long lists can be difficult to read in the array',
            hint: 'Use $inject method instead -> my%(method)sFunction.$inject = [%(args)s... ];',
            why: ['An $inject statement can easily precede the resolver to handle making any dependencies minification safe',
                  'This technique breaks out the anonymous function for the route resolver, making it easier to read']
        },
        httpInController: {
            body: 'Avoid using $http service in controllers.',
            hint: 'Use a factory to handle http connections instead.',
            why: ['Logic may be reused by multiple controllers when placed within a service and exposed via a function',
                  'Keeps the controller slim, trim, and focused',
                  'Removes dependencies and hides implementation details from the controller']
        },
        noVmInController: {
            body: 'Use a capture variable for "this" when using the controllerAs syntax',
            hint: 'Use var vm = this; at the top of your controller',
            why: ['The this keyword is contextual and when used within a function inside a controller may change its context. Capturing the context of this avoids encountering this problem']
        },
        noEAInDirective: {
            body: 'Avoid using $http service in controllers.',
            hint: 'Use a factory to handle http connections instead.',
            why: ['While we can allow the directive to be used as a class, if the directive is truly acting as an element it makes more sense as an element or at least as an attribute']
        }
    }
}

exports.utils = utils;