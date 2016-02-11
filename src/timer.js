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
