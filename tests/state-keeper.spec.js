var StateKeeper = require('../src/state-keeper');
var Subject = require('../src/subject');

var assert = require('chai').assert;
require("setimmediate");

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
      pause: {
        from: "playing",
        to: "paused"
      },
      end: {
        from: /.*/,
        to: 'ready'
      },
      screenshot:{
        from: "playing",
        to: "playing"
      }
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

  it("mustn't transition on unvalid value", function (done) {
    subject.trigger('foo');
    setTimeout(function (){
      assert.equal(wf.get(), 'ready');
      assert.equal(counter_play, 0);
      assert.equal(counter_paused, 0);
      done();
    }, 10);
  });

  it("mustn't transition from wrong state", function (done) {
    subject.trigger('pause');
    setTimeout(function (){
      assert.equal(wf.get(), 'ready');
      assert.equal(counter_play, 0);
      assert.equal(counter_paused, 0);
      assert.equal(counter_resumed, 0);
      done();
    }, 10);
  });

  it("must transition from correct state", function (done) {
    subject.trigger('play');
    setTimeout(function (){
      assert.equal(wf.get(), 'playing');
      assert.equal(counter_play, 1);
      assert.equal(counter_paused, 0);
      assert.equal(counter_resumed, 0);
      done();
    }, 10);
  });

  it("must transition from correct state 2", function (done) {
    subject.trigger('play');
    subject.trigger('pause');
    setTimeout(function (){
      assert.equal(wf.get(), 'paused');
      assert.equal(counter_play, 1);
      assert.equal(counter_paused, 1);
      assert.equal(counter_resumed, 0);
      done();
    }, 10);
  });

  it("must transition from correct state 3", function (done) {
    subject.trigger('play');
    subject.trigger('xxx');
    setTimeout(function (){
      assert.equal(wf.get(), 'playing');
      assert.equal(counter_play, 1);
      assert.equal(counter_paused, 0);
      assert.equal(counter_resumed, 0);
      done();
    }, 10);
  });

  it("must transition from correct state 4", function (done) {
    subject.trigger('play');
    subject.trigger('pause');
    subject.trigger('play');
    setTimeout(function (){
      assert.equal(wf.get(), 'playing');
      assert.equal(counter_play, 2);
      assert.equal(counter_paused, 1);
      assert.equal(counter_resumed, 1);
      done();
    }, 10);
  });

  it("must transition using regexp", function (done) {
    subject.trigger('play');
    subject.trigger('end');
    setTimeout(function (){
      assert.equal(wf.get(), 'ready');
      done();
    }, 10);
  });

  it("must pass correct state", function (done) {
    wf.on("playing", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
      done();
    });
    subject.trigger('play');
  });

  it("can use wildcards", function (done) {
    wf.on("*", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
      done();
    });
    subject.trigger('play');
  });

  it("can use wildcards 2", function (done) {
    var times = 0;
    wf.on("*.*", function (evt){
      times++;
      if (times == 1){
        assert.equal(evt.type, 'leave');
        assert.equal(evt.state, 'ready');
      }
      else {
        assert.equal(evt.type,'enter');
        assert.equal(evt.state, 'playing');
        done();
      }
    });
    subject.trigger('play');
  });

  it("can use wildcards 3", function (done) {
    var times = 0;
    wf.on(function (evt){
      times++;
      if (times == 1){
        assert.equal(evt.type, 'leave');
        assert.equal(evt.state, 'ready');
      }
      else {
        assert.equal(evt.type,'enter');
        assert.equal(evt.state, 'playing');
        done();
      }
    });
    subject.trigger('play');
  });

  it("can use wildcards 4", function (done) {
    wf.on("enter.*", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
      done();
    });
    subject.trigger('play');
  });

  it("can use wildcards 5", function (done) {
    wf.on("*.playing", function (evt){
      assert.equal(evt.type, 'enter');
      assert.equal(evt.state, 'playing');
      done();
    });
    subject.trigger('play');
  });

  it("can be destroyed", function () {
    assert.doesNotThrow(function (){
      wf.destroy();
    });
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


  it("get the input from 1 subjects", function (done) {
    assert.equal(wf.get(), 'ready');
    row_left.trigger('row');
    setTimeout(function (){
      assert.equal(wf.get(), 'turned_left');
      row_left.trigger('row');
      setTimeout(function (){
        assert.equal(wf.get(), 'turned_left');
        done();
      }, 10);
    }, 10);
  });

  it("get the input from 2 subjects", function () {
    assert.equal(wf.get(), 'ready');
    row_left.trigger('row');
    setTimeout(function (){
      assert.equal(wf.get(), 'turned_left');
      row_right.trigger('row');
      setTimeout(function (){
        assert.equal(wf.get(), 'going_ahead');
      }, 10);
    }, 10);
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

  it("transition to a function 1", function (done) {
      wf.on("playing", function (evt){
        assert.equal(evt.type, "enter");
        assert.equal(evt.state.name, "playing" );
        done();
      });
      sub.trigger("play");
  });

  it("transition to a function 2", function (done) {

      sub.trigger("play");
      setTimeout(function (){
        assert.deepEqual(wf.get(), {name: "playing", number: 1});
        sub.trigger("play");
        setTimeout(function (){
          assert.deepEqual(wf.get(), {name: "paused", number: 1});
          sub.trigger("play");
          setTimeout(function (){
            assert.deepEqual(wf.get(), {name: "playing", number: 2});
            done();
          }, 10);
        }, 10);
      }, 10);
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
       sub.trigger('play');
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
       sub.trigger('play');
    });

  });

});

describe("State events implemented as a queue", function () {
  var sub, wf;

  beforeEach(function (){
    sub = Subject();

    wf = StateKeeper(sub, {
      play: [
        {from:"ready",   to: "playing"},
      ],
      stop: [
        {from:"playing",   to: "ready"},
      ]
    });

    wf.on('enter.playing', function (e){
      this.trigger('stop');
    });

  });


  it("respect the order", function (done) {
    var s = "";
    wf.on('enter.playing', function (e){
      s += "first ";
    });

    wf.on('leave.playing', function (e){
      s += "second";
    });

    sub.trigger('play');
    setTimeout(function (){
      assert.equal(s, "first second");
      done();
    }, 10);

  });

});

describe("Timer", function () {
  var sub, wf;

  beforeEach(function (){
    sub = Subject();

    wf = StateKeeper(sub, {
      play: [
        {from:"ready",   to: "playing", timer_time: 10, timer: "timeout"},
        {from:"playing", to: "pause"}
      ],
      "timer:timeout": [
        {from:"playing", to: "ready"}
      ],
      bounce: [
        {from:"ready",   to: "1", timer: "ping"},
      ],
      "timer:ping": [
        {from:"1",   to: "2", timer: "pong"},
      ],
      "timer:pong": [
        {from:"2",   to: "ready"},
      ],
    });


  });


  it("times out", function (done) {

    sub.trigger('play');
    assert.equal(wf.get(), "playing");
    setTimeout(function (){
      assert.equal(wf.get(), "ready");
      done();
    }, 20);

  });

  it("transition automatically", function (done) {
    var s = "";
    wf.on("enter.1", function (){
      s += "ping";
    });

    wf.on("enter.2", function (){
      s += "pong";
    });

    sub.trigger('bounce');

    setTimeout(function (){
      assert.equal(s, "pingpong");
      assert.equal(wf.get(), "ready");
      done();
    }, 10);
  });

});

describe("Timer interval", function () {
  var sub, wf, isReady;

  beforeEach(function (){
    sub = Subject();

    wf = StateKeeper(sub, {
      play: [
        {from:"ready", to: "loadVideo", timer_interval: 10, timer: "contentReady"}
      ],
      "timer:contentReady": [
        {
          from:function (st){
            return st === "loadVideo" && isReady;
          },
          to: "playing"
        }
      ]
    });
  });


  it("times out", function (done) {
    sub.trigger('play');
    assert.equal(wf.get(), "loadVideo");
    setTimeout(function (){
      assert.equal(wf.get(), "loadVideo");
      isReady = true;
      setTimeout(function (){
        assert.equal(wf.get(), "playing");
        done();
      }, 20);
    }, 20);

  });


});


describe("more than one events leads to the same transition", function () {
  var video1, video2;
  var wf;

  beforeEach(function (){
    video1 = Subject();
    video2 = Subject();

    wf = StateKeeper({video1: video1, video2: video2}, {
      "video1:play, video2:play" : [
        {
          from: 'ready',
          to: "playing"
        },
        {
          from: 'playing',
          to: "ready"
        }
      ]
    });
  });


  it("get the input from 1 subjects", function () {
    assert.equal(wf.get(), 'ready');
    video1.trigger('play');
    assert.equal(wf.get(), 'playing');
    video2.trigger('play');
    assert.equal(wf.get(), 'ready');
  });

});

describe("transition to the same state", function () {
  var video;
  var wf;

  beforeEach(function (){
    video = Subject();

    wf = StateKeeper(video, {
      play : [
        {
          from: 'ready',
          to: "playing"
        },
        {
          from: 'playing',
          to: "playing"
        }
      ]
    });
  });

  it("don't fire event twice", function (done) {
    var counter_enter = 0;
    var counter_stay = 0;
    wf.on('enter.playing', function (){
      counter_enter++;
    });

    wf.on('stay.playing', function (){
      counter_stay++;
    });

    video.trigger('play');
    assert.equal(wf.get(), 'playing');
    video.trigger('play');

    setTimeout(function (){
      assert.equal(counter_enter, 1);
      assert.equal(counter_stay, 1);
      done();
    }, 10);
  });

});
