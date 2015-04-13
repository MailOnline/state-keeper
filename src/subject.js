(function (){

  var Subject = function (bindMethod, unbindMethod){
    var cbs = {};

    bindMethod = bindMethod || 'on';
    unbindMethod = unbindMethod || 'off';

    var out = {};

    out[bindMethod] = function (type, cb){
      if (type in cbs){
        cbs[type].push(cb);
      }
      else {
        cbs[type] = [cb];
      }
    };

    out[unbindMethod] = function (type, func){
      var i, out;
      if (type in cbs){
        if (typeof func == "undefined"){
          delete cbs[type];
        }
        else {
          out = [];
          for (i = 0;i < cbs[type].length ; i++){
            if (cbs[type][i] !== func){
              out.push(cbs[type][i]);
            }
          }
          cbs[type] = out;
        }
      }
    };

    out.trigger = function (type, evt){
      var i;
      if (type in cbs){
        for (i = 0;i < cbs[type].length ; i++){
          cbs[type][i].call(this, evt);
        }
      }
    };

    return out;
  };

  if (typeof exports === 'object'){
      module.exports = Subject;
  }
  else if (typeof window === 'object'){
      window.StateKeeper.Subject = Subject;
  }

}());
