(function (){
"use strict";


function isString(s){
  return (typeof s === "string" ) || (s instanceof String);
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
    new Error(from + " (from) can be either a string, a regular expression or a function");
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
    new Error(to + " (to) can be either a string, a function or a state object");
  }
}

function StateKeeper (subject, transitions, options) {
  options = options || {};
  var currentState = options.initialState || "ready";
  var oldState;
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

  var callbacks = {};
  var queue = [];
  var interval;

  for (var transition in transitions){
    t = transition.split(':');
    if (t.length < 2){
      t.unshift('default');
    }
    sub = subject[t[0]];

    sub[bind](t[1], (function (s, sub){
      return function (evt){
        for(var i = 0; i < s.length; i++){
          if (test.call(sub, s[i].from, currentState, evt)){
            oldState = currentState;
            currentState = changeState.call(sub, s[i].to, currentState, evt);

            setImmediate((function (sub, oldState, currentState, evt){
              return function (){
                run.call(sub, 'leave', oldState, evt);
                run.call(sub, 'enter', currentState, evt);
              };
            }(sub, oldState, currentState, evt)));

            break;
          }
        }
      };
    }(transitions[transition], sub) ));
  }

  return {
    get: function (){
      return currentState;
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
      var t;
      for (var transition in transitions){
        t = transition.split(':');
        if (t.length < 2){
          t.unshift('default');
        }
        sub = subject[t[0]];

        sub[unbind](t[1]);
      }
      if (interval) clearInterval(interval);
    }
  };
}

if (typeof module.exports === 'object'){
    module.exports = StateKeeper;
}
else if (typeof window === 'object'){
    // Expose StateKeeper to the browser global object
    window.StateKeeper = StateKeeper;
}

}());
