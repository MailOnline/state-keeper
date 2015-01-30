var StateKeeper = require('../src/state-keeper');
var assert = require('chai').assert;
// mock
var Subject = function (){
  var cbs = {};
  return {
    on: function (type, cb){
      cbs[type] = cb;
    },
    trigger: function (type, evt){
      cbs[type] && cbs[type].call(this, evt);
    }
  };
};

describe("workflow machine", function () {
  var subject;
  var wf;
  var counter_play;
  var counter_paused;
  var counter_resumed;

  beforeEach(function (){
    counter_play = 0;
    counter_paused = 0;
    counter_resumed = 0;

    subject = Subject();

    wf = StateKeeper(subject, {
      play : [
        {
          from: 'ready',
          to: "playing"
        },
        {
          from: "paused",
          to: "playing"
        },
      ],
      pause: [
        {
          from: "playing",
          to: "paused"
        }
      ],
      end: [
        {
          from: /.*/,
          to: 'ready'
        }
      ],
      screenshot: [
        {
          from: "playing",
          to: "playing"
        }
      ]
    });

    wf.on('playing', function (){
        counter_play++;
    });

    wf.on('paused', function (){
        counter_paused++;
    });

    wf.on('leave.paused', function (){
        counter_resumed++;
    });

  });

  it("must return initial state", function () {
    assert.equal(wf.get(), 'ready');
  });

  it("mustn't transition on unvalid value", function () {
    subject.trigger('foo');
    assert.equal(wf.get(), 'ready');
    assert.equal(counter_play, 0);
    assert.equal(counter_paused, 0);
  });

  it("mustn't transition from wrong state", function () {
    subject.trigger('pause');
    assert.equal(wf.get(), 'ready');
    assert.equal(counter_play, 0);
    assert.equal(counter_paused, 0);
    assert.equal(counter_resumed, 0);
  });

  it("must transition from correct state", function () {
    subject.trigger('play');
    assert.equal(wf.get(), 'playing');
    assert.equal(counter_play, 1);
    assert.equal(counter_paused, 0);
    assert.equal(counter_resumed, 0);
  });

  it("must transition from correct state 2", function () {
    subject.trigger('play');
    subject.trigger('pause');
    assert.equal(wf.get(), 'paused');
    assert.equal(counter_play, 1);
    assert.equal(counter_paused, 1);
    assert.equal(counter_resumed, 0);
  });

  it("must transition from correct state 3", function () {
    subject.trigger('play');
    subject.trigger('xxx');
    assert.equal(wf.get(), 'playing');
    assert.equal(counter_play, 1);
    assert.equal(counter_paused, 0);
    assert.equal(counter_resumed, 0);
  });

  it("must transition from correct state 4", function () {
    subject.trigger('play');
    subject.trigger('pause');
    subject.trigger('play');
    assert.equal(wf.get(), 'playing');
    assert.equal(counter_play, 2);
    assert.equal(counter_paused, 1);
    assert.equal(counter_resumed, 1);
  });

  it("must transition using regexp", function () {
    subject.trigger('play');
    subject.trigger('end');
    assert.equal(wf.get(), 'ready');
  });

  it("must transition multiple time", function () {
    subject.trigger('play');
    subject.trigger('screenshot');
    subject.trigger('screenshot');

    assert.equal(wf.get(), 'playing');
    assert.equal(counter_play, 3);
  });

  it("must transition multiple time", function () {
    subject.trigger('play');
    subject.trigger('screenshot');
    subject.trigger('screenshot');

    assert.equal(wf.get(), 'playing');
    assert.equal(counter_play, 3);

  });


  it("must pass correct state", function () {
    wf.on("playing", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
    });
    subject.trigger('play');
  });

  it("can use wildcards", function () {
    wf.on("*", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
    });

    wf.on("*.*", function (evt){
      assert(evt.type == 'enter' || evt.type == 'leave');
      assert(evt.state == 'playing' || evt.state == 'ready');
    });

    wf.on(function (evt){
      assert(evt.type == 'enter' || evt.type == 'leave');
      assert(evt.state == 'playing' || evt.state == 'ready');
    });

    wf.on("enter.*", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
    });

    wf.on("*.playing", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
    });

    subject.trigger('play');
  });

});

describe("workflow machine (2 subjects)", function () {
  var subject1, subject2;
  var wf;

  beforeEach(function (){
    row_left = Subject();
    row_right = Subject();

    wf = StateKeeper({row_left: row_left, row_right: row_right}, {
      "row_left:row" : [
        {
          from: 'ready',
          to: "turned_left"
        },
        {
          from: 'turned_right',
          to: "going_ahead"
        },
      ],
      "row_right:row" : [
        {
          from: 'ready',
          to: "turned_right"
        },
        {
          from: 'turned_left',
          to: "going_ahead"
        },
      ]
    });
  });


  it("get the input from 1 subjects", function () {
    assert.equal(wf.get(), 'ready');
    row_left.trigger('row');
    assert.equal(wf.get(), 'turned_left');
    row_left.trigger('row');
    assert.equal(wf.get(), 'turned_left');
  });

  it("get the input from 2 subjects", function () {
    assert.equal(wf.get(), 'ready');
    row_left.trigger('row');
    assert.equal(wf.get(), 'turned_left');
    row_right.trigger('row');
    assert.equal(wf.get(), 'going_ahead');
  });

});

describe("state can be an object", function () {
  var sub, wf;
  beforeEach(function (){
    sub = Subject();

    wf = StateKeeper(sub, {
      play: [
        {from:"ready",   to: {name: "playing", number: 1}},
        {from:"playing", to: function (state){return {name: "paused",  number: state.number    };}},
        {from:"paused",  to: function (state){return {name: "playing", number: state.number + 1};}}
      ]
    });

  });

  it("transition to a function", function () {
      wf.on("playing", function (evt){
        assert.equal(evt.type, "enter");
        assert.equal(evt.state.name, "playing" );
      });

      sub.trigger("play");
      assert.deepEqual(wf.get(), {name: "playing", number: 1});
      sub.trigger("play");
      assert.deepEqual(wf.get(), {name: "paused", number: 1});
      sub.trigger("play");
      assert.deepEqual(wf.get(), {name: "playing", number: 2});

    });

});

describe("must throw an error if the state is not valid", function () {

  it("start with an invalid state", function () {
    var sub = Subject();

    assert.throws(function (){
      var wf = StateKeeper(sub, {
        play: [
          {from:"ready",   to: function (){}},
        ]
      }, {initialState: {}});
    });

  });

  it("transition to an invalid object", function () {
    var sub = Subject();
    var wf = StateKeeper(sub, {
      play: [
        {from:"ready",   to: {number: 1}},
      ]
    });

    assert.throws(function (){
       sub.trigger('play')
    });

  });

  it("transition to a undefined", function () {
    var sub = Subject();
    var wf = StateKeeper(sub, {
      play: [
    {from:"ready",   to: function (){}},
      ]
    });

    assert.throws(function (){
       sub.trigger('play')
    });

  });

});
