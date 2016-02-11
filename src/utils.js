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
