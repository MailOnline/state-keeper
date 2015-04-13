var StateKeeper = require('../src/state-keeper');
var Subject = require('../src/subject');

var assert = require('chai').assert;
require("setimmediate");

describe("subject", function () {
  var subject;
  beforeEach(function (){
    subject = Subject();
  });

  it("must be defined", function () {
    assert.isDefined(subject);
  });

  it("must subscribe events", function () {
    var c = 0;
    subject.on("add", function (){
      c++;
    });
    subject.on("add", function (){
      c++;
    });
    subject.on("reset", function (){
      c = 0;
    });

    subject.trigger("add");
    assert.equal(c, 2);
    subject.trigger("reset");
    assert.equal(c, 0);
  });

  it("must unsubscribe events", function () {
    var c = 0;
    var func1 = function (){
      c++;
    };
    var func2 = function (){
      c++;
    };

    subject.on("add", func1);
    subject.on("add", func2);
    subject.on("reset", function (){
      c = 0;
    });

    subject.off("add", func2);

    subject.trigger("add");
    assert.equal(c, 1);
    subject.trigger("reset");
    assert.equal(c, 0);
  });

  it("must pass event object", function (done) {
    subject.on("test", function (evt){
      assert.equal(evt, "test");
      done();
    });
    subject.trigger("test", "test");
  });

});
