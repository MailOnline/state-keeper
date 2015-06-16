(function (){
"use strict";

var Timer = function (bindMethod, unbindMethod){
  var cbs = {};
  var toHandler;

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
  };

  out.trigger = function (type, timeout){
    if (cbs[type]){
      if (timeout){
        toHandler = setTimeout(_trigger(type), timeout);
      }
      else {
        setImmediate(_trigger(type));
      }
    }
  };

  out.reset = function (){
    clearTimeout(toHandler);
  };

  return out;

};

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

function StateKeeper (subject, transition_groups, options) {
  options = options || {};
  var currentState = options.initialState || "ready";
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
    throw new Error(s + " the word 'timer' in the subjects map is reserved");
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

      handler = (function (s, sub){
        return function (evt){
          for(var i = 0; i < s.length; i++){
            if (test.call(sub, s[i].from, currentState, evt)){
              subject.timer.reset();
              oldState = currentState;
              currentState = changeState.call(sub, s[i].to, currentState, evt);
              checkState(currentState);

              setImmediate((function (sub, oldState, currentState, evt){
                return function (){
                  run.call(sub, 'leave', oldState, evt);
                  run.call(sub, 'enter', currentState, evt);
                };
              }(sub, oldState, currentState, evt)));

              if (s[i].timer){
                subject.timer.trigger(s[i].timer, s[i].timer_time);
              }

              break;
            }
          }
        };
      }(transition_groups[transition_group], sub) );

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

if (typeof exports === 'object'){
    module.exports = StateKeeper;
}
else if (typeof window === 'object'){
    // Expose StateKeeper to the browser global object
    window.StateKeeper = StateKeeper;
}

}());
