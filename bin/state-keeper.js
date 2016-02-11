(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.StateKeeper = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
(function (process,global){
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var setImmediate;

    function addFromSetImmediateArguments(args) {
        tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
        return nextHandle++;
    }

    // This function accepts the same arguments as setImmediate, but
    // returns a function that requires no arguments.
    function partiallyApplied(handler) {
        var args = [].slice.call(arguments, 1);
        return function() {
            if (typeof handler === "function") {
                handler.apply(undefined, args);
            } else {
                (new Function("" + handler))();
            }
        };
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    task();
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function installNextTickImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            process.nextTick(partiallyApplied(runIfPresent, handle));
            return handle;
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            global.postMessage(messagePrefix + handle, "*");
            return handle;
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            channel.port2.postMessage(handle);
            return handle;
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
            return handle;
        };
    }

    function installSetTimeoutImplementation() {
        setImmediate = function() {
            var handle = addFromSetImmediateArguments(arguments);
            setTimeout(partiallyApplied(runIfPresent, handle), 0);
            return handle;
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":1}],3:[function(require,module,exports){
"use strict";

var utils = require('./utils');
var isString = utils.isString;
var setImmediate = utils.setImmediate;
var Timer = require('./timer');

module.exports = StateKeeper;

function StateKeeper (subject, transition_groups, options) {
  options = options || {};
  var currentState = options.initialState || "ready";
  var onTransition = options.onTransition || function (){};
  var oldState;
  var handler;
  var transition, transitions;
  var handlers_list = [];
  var bind = options.bindMethod || 'on';
  var unbind = options.unbindMethod || 'off';

  function run(enter_leave, currentState, evt){
    var cbs = [].concat(callbacks[enter_leave + '.' + getStateString(currentState)] || [],
                        callbacks['*.*'] || [],
                        callbacks[enter_leave + '.*'] || [],
                        callbacks['*.' + getStateString(currentState)] || []);

    for (var c = 0; c < cbs.length; c++){
      cbs[c].call(this, {type: enter_leave, state: currentState , event: evt});
    }
  }

  checkState(currentState);

  var t, sub;

  if (typeof subject[bind] === 'function'){
    subject = {
      "default": subject
    };
  }

  if (subject.timer){
    throw new Error(subject + " the word 'timer' in the subjects map is reserved");
  }

  subject.timer = Timer(bind, unbind);

  var callbacks = {};
  var queue = [];

  for (var transition_group in transition_groups){
    transitions = transition_group.split(/[\s,]+/);

    for (var j = 0; j < transitions.length; j++){
      transition = transitions[j];

      t = transition.split(':');
      if (t.length < 2){
        t.unshift('default');
      }
      sub = subject[t[0]];

      handler = (function (transition, s, sub){
        s = typeof s.length === "undefined" ? [s] : s;
        return function (evt){
          for(var i = 0; i < s.length; i++){
            if (test.call(sub, s[i].from, currentState, evt)){
              subject.timer.reset();
              oldState = currentState;
              currentState = changeState.call(sub, s[i].to, currentState, evt);
              checkState(currentState);

              onTransition(oldState, currentState, transition, evt); // useful for debug

              if(getStateString(oldState) === getStateString(currentState)){
                setImmediate((function (sub, oldState, currentState, evt){
                  return function (){
                    run.call(sub, 'stay', currentState, evt);
                  };
                }(sub, oldState, currentState, evt)));
              }
              else {
                setImmediate((function (sub, oldState, currentState, evt){
                  return function (){
                    run.call(sub, 'leave', oldState, evt);
                    run.call(sub, 'enter', currentState, evt);
                  };
                }(sub, oldState, currentState, evt)));
              }


              if (s[i].timer){
                subject.timer.trigger(s[i].timer, s[i].timer_time, s[i].timer_interval);
              }

              break;
            }
          }
        };
      }(transition, transition_groups[transition_group], sub) );

      // store "eventtype" and "handler" here (in case I need to unbind them all)
      handlers_list.push([t[1], handler]);
      sub[bind](t[1], handler); // listening to events
    }
  }

  return {
    get: function (){
      return currentState;
    },
    set: function (s){
      currentState = s;
    },
    on: function (state, cb){
      if (!cb){
        cb = state;
        state = "*.*";
      }
      // state -> enter.statex
      var s = state.split(".");
      if (s.length < 2){
        s.unshift('enter');
      }

      state = s.join(".");
      if (callbacks[state]){
        callbacks[state].push(cb);
      }
      else {
        callbacks[state] = [cb];
      }
    },
    destroy: function (){
      var i, eventtype, func;
      for (i = 0; i< handlers_list.length;i++){
        eventtype = handlers_list[i][0];
        func = handlers_list[i][1];
        sub[unbind](eventtype, func);
      }
    }
  };
}

function isValidState(s){
    return (isString(s)) || ((typeof s === "object") && ("name" in s));
}

function checkState(s){
  if (!isValidState(s)) throw new Error(s + " not a valid state");
}

function getStateString(s){
  return isString(s) ? s : s.name;
}

function test(from, st, evt){
  var stateName = getStateString(st);
  if (from instanceof RegExp){ // regexp
    return from.test(stateName);
  }
  else if (typeof from === "function") {
    return from.call(this, st, evt);
  }
  else if (isString(from)){
    return from === stateName;
  }
  else {
    throw new Error(from + " (from) can be either a string, a regular expression or a function");
  }
}

function changeState(to, st, evt){
  if (typeof to === "function") {
    return to.call(this, st, evt);
  }
  else if (isValidState(to)){
    return to;
  }
  else {
    throw new Error(to + " (to) can be either a string, a function or a state object");
  }
}

},{"./timer":4,"./utils":5}],4:[function(require,module,exports){
"use strict";

var setImmediate = require('./utils').setImmediate;

var Timer = function (bindMethod, unbindMethod){
    var cbs = {};
    var toHandler;
    var tiHandler;

    var _trigger = function (type){
        return function (){
            for (var i = 0; i < cbs[type].length; i++){
                cbs[type][i]();
            }
        };
    };

    var out = {};

    out[bindMethod] = function (type, cb){
        if (cbs[type]){
            cbs[type].push(cb);
        }
        else {
            cbs[type] = [cb];
        }
    };

    out[unbindMethod] = function (type){
        delete cbs[type];
        clearTimeout(toHandler);
        clearTimeout(tiHandler);
    };

    out.trigger = function (type, timeout, interval){
        if (cbs[type]){
            if (timeout){
                toHandler = setTimeout(_trigger(type), timeout);
            }
            else if (interval){
                tiHandler = setInterval(_trigger(type), interval);
            }
            else {
                setImmediate(_trigger(type));
            }
        }
    };

    out.reset = function (){
        clearTimeout(toHandler);
        clearInterval(tiHandler);
    };

    return out;

};

module.exports = Timer;

},{"./utils":5}],5:[function(require,module,exports){
(function (global){
"use strict";

require('setimmediate/setImmediate');

var root = (global === 'undefined' ? window : global);

function isString(s){
  return (typeof s === "string" ) || (s instanceof String);
}

module.exports = {
  isString: isString,
  setImmediate: root.setImmediate
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"setimmediate/setImmediate":2}]},{},[3])(3)
});