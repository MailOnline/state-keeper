StateKeeper
===========

StateKeeper is a simple but customizable state machine. Compared to other state machines, it works in a slightly different way:
It observes one or more observables (sorry for the pun) and uses their events to transition to different states (a state can be as simple as a string).

It can be pretty useful for abstracting a complex state from basic low level events. If you are confused at this point don't worry, everything will become clear in a few lines.

About observables
=================
An observable is an object able to fire events.
Example of observables are:

  - a jquery object (http://api.jquery.com/on/)
  - a backbone event (http://backbonejs.org/#Events)
  - a node.js eventEmitter (http://nodejs.org/api/events.html)

In the next examples I will use the default jQuery object containing ".on" and ".trigger" methods.

Simple Example
==============
In this example videoPlayer is an observable that fires a "play" event every time someone clicks on play. I can configure StateKeeper to keep track of the state of the player:

    var state = StateKeeper(videoPlayer, {
      play: [
        {from:"ready", to:"playing"},
        {from:"playing", to:"paused"},
        {from:"paused", to:"playing"}
      ]
    });

StateKeeper takes as parameters the observable (videoPlayer) and a map of transitions (optionally an options object).
For each transition (fired by the observable) I have a list of state changes.
In this example when the subject fires the event "play" I can change the state from "ready" (the default initial state) to "playing", from "playing" to "paused" and the other way around.
Any other event will be ignored, for example there is no way to getting back to the initial "ready" state.
Let's see what happens when videoPlayer fires events:

    videoPlayer.trigger('play');
    state.get() === "playing"
    videoPlayer.trigger('play');
    state.get() === "paused"
    videoPlayer.trigger('play');
    state.get() === "playing"

"get" is the method to call if you want to get the current state.
You can do something when you enter into a state:

    state.on('enter.playing', function (event){
      console.log('The player is ... ehm ... playing')
    });

You can also do something else when you are leaving a state:

    state.on('leave.playing', function (event){
      console.log('The player is paused')
    });

    state.on('leave.ready', function (event){
      console.log('The player is activated for the first time')
    });

With "on" you can attach a function when the state changes. A stateKeeper instance fires an event called "enter.statename" when it enters a new state and "leave.statename" when it is leaving a state.
There are a few shortcuts available:

  - "*.statename" will run the function for "enter.statename" and "leave.statename"
  - "enter.*" will run the function every time it transitions to a new state
  - "leave.*" will run the function every time it is leaving a state
  - "*.*" will run the function for any state, when it is entering and leaving
  - omitting the first argument is equivalent to using "*.*"
  - "statename" is the same as "enter.statename"
  - "*" is the same as "enter.*"

Now you should start realizing how this thing can be useful. With a simple declarative syntax we are able to keep track of the various state of the videoPlayer!

Event object
------------
Event is the argument passed to the function. It contains 3 properties:

  - type: "enter" or "leave"
  - state: the state
  - event: the original event object that triggered the state change

More complex transition conditions
----------------------------------
There are few cases where you want be able to define more complicated transition conditions.

    var state = StateKeeper(videoPlayer, {
      play: [
        {from:"ready", to:"playing"},
        {from:"playing", to:"paused"},
        {from:"paused", to:"playing"}
      ],
      reset: [
        {from: new RegExp('.*'), to: 'ready'}
      ]
    });

In this example if the videoPlayer fires the "reset" event I want to go back to the initial "ready" state whatever the current state is.
I can also use a function to do even more complex stuff:

    var state = StateKeeper(videoPlayer, {
      play: [
        {from:"ready", to:"playing"},
        {from:"playing", to:"paused"},
        {from:"paused", to:"playing"}
      ],
      reset: [
        {from: new RegExp('.*'), to: 'ready'}
      ],
      stop: [
        {
          from: function (currentState, evt){
            return currentState === "playing" && this.duration === this.currentTime;
          },
          to: 'ended'
        },
        {
          from: function (currentState, evt){
            return currentState === "playing" && this.duration !== this.currentTime;
          },
          to: 'ready'
        }
      ]
    });

In this example I have used a function for deciding if I should transition to the "ended" state.
If I get a "stop" event from the videoPlayer then I check the current state (it is passed as an argument to the function).
The other argument is the original event object as it is passed by the function callback.
The function also gets the subject (videoPlayer in this case) as "this".
I check if the video has finished playing, in which case I transition to the "ended" state. Otherwise I go to the "ready" state.

Initial state
-------------
The initial state is the string "ready" by default but you can change it in the options:

    var state = StateKeeper(videoPlayer, {
      ... event/state map
    },
    {
      initialState: "initial"
    });

Using an object
---------------
Until now I have used a simple string as event. In reality you could use an object. This will allow us to do something a bit more complex:

    var state = StateKeeper(videoPlayer, {
      play: [
        {from:"ready",   to: {name: "playing", number: 1}},
        {from:"playing", to: function (state, evt){return {name: "paused",  number: state.number};}},
        {from:"paused",  to: function (state, evt){return {name: "playing", number: state.number + 1};}}
      ]
    });

    state.on("playing", function (evt){
      console.log("Playing for " + evt.state.number + " times");
    });

A state object is a plain old js object containing a property "name" (this is required). This property will be used any time a string is expected (triggering events, transitioning from string/regexp).
The "from" can also be defined as "object" or as a function taking the previous state as argument.

More than one observable
------------------------
StateKeeper is able to keep track of many different observables. You can do this by passing, instead of a single object, a map of observables {label: observable}. You can then use the label to tell what event of what observable you should listen to:

    var state = StateKeeper({video1: videoPlayer1, video2: videoplayer2}, {
      "video1:play": [
        {from:"ready",          to: "video1_playing",
        {from:"video1_playing", to: "ready"},
        {from:"video2_playing", to: "all_playing"},
        {from:"all_playing",    to: "video2_playing"}
      ],
      "video2:play": [
        {from:"ready",          to: "video2_playing"},
        {from:"video2_playing", to: "ready"},
        {from:"video1_playing", to: "all_playing"},
        {from:"all_playing",    to: "video1_playing"}
      ]
    });


In this example I am listening to 2 different video players so that I have available a state that is the combination of both. The word "timer" in the constructor map is reserved.

Timer
-----
Sometimes you really need to transition sequentially through a series of states, or you just need to go back to the initial state after a short time is passed. The timer helps to do so.
It is a special subject (observable), and you can listen to its event prefixing the event name with "timer:".
In the transition map you can add a field "timer" with the name of the event, if the transition succeeds the event will be triggered. Example:

    var state = StateKeeper(videoPlayer, {
      "play": [
        {from:"ready",     to: "firstPlay", timer: "start"},
        {from:"playing",   to: "pause"},
        {from:"pause",     to: "playing"}
      ],
      "timer:start": [
        {from:"firstPlay", to: "playing"}
      ]
    });

In this example when the videoPlayer triggers the "play" event the first time (from the state "ready") the state will transition like this:

    "ready" -> "firstPlay" -> "playing"

From that point on the "play" event can be used for transitioning from "play" to "pause" and the other way around. Adding an intermediate state can help to fire a specific event only if you get in a particular state from another:

    state.on("firstPlay", function (){
      // this is executed only the first time you play a video
    });

Another useful use case for the timer is when you need to transition automatically using a timeout:

    var state = StateKeeper(videoPlayer, {
      "play": [
        {from:"ready",     to: "waitingAd", timer: "adTimeout", timer_time: 500}
      ],
      "adPlay": [
        {from:"waitingAd", to: "adPlaying"}
      ],
      "adEnd": [
        {from:"adPlaying", to: "contentPlaying"}
      ],
      "timer:adTimeout": [
        {from:"waitingAd", to: "contentPlaying"}
      ]
    });

In this case the videoplayer waits for an ad to show before the video. After a timeout of 500ms it transitions directly to the contentPlaying state.

Cleaning up
-----------
Statekeeper attaches event handlers to do its job. If you don't use it anymore you should call the "destroy" method for freeing the resources.

bindMethod / unbindMethod
-------------------------
StateKeeper uses '.on' to listen for events on the subject. You can change the default method with the options:

    var videoPlayer = document.getElementsByTagName('video')[0];

    var state = StateKeeper(videoPlayer, {
      play: [
        {from:"ready", to:"playing"},
        {from:"playing", to:"paused"},
        {from:"paused", to:"playing"}
      ]
    },
    {
      bindMathod: "addEventListener",
      unbindMethod: "removeEventListener"
    });

Testing StateKeeper
-------------------
It is a good idea testing the StateKeeper setup (using your favourite unit test suite). For make things easier I suggest you to test transition by transition.
You can do that setting the state by hand:

    state.set("play");

And using a very simple observable implementation:

    var Subject = require('state-keeper/src/subject');

or

    var Subject = StateKeeper.Subject;

Then you can set it up using:

    var subject = Subject();

You can pass the bind and unbind method names (default on, off):

    var subject = Subject('addEventListener', 'removeEventListener');

Subject has a very simple api:

    subject.on("test", function (evt){
      console.log(evt);
    });

    subject.trigger('test', {hello: "world!"});

This will print '{hello: "world!"}'.
So this is an example on how we can test a single transition, let's start from a state machine configured:

    function getstate(videoPlayer){
      var state = StateKeeper(videoPlayer, {
        play: [
          {from:"ready", to:"playing"},
          {from:"playing", to:"paused"},
          {from:"paused", to:"playing"}
        ]
      });
      return state;
    }

I can inject a fake videoPlayer:

    var videoPlayer = Subject();
    var state = getstate(videoPlayer);

Then I test a specific transition:

    state.set("paused"); // I start from this state
    videoPlayer.trigger("play");
    assert(state.get(), "playing");

Easy as that!
If you use timers for transitioning automatically you can use [sinonjs fake timers](http://sinonjs.org/docs/#clock) like this (I am using qunit here):

    module("test transition", {
    	setup: function (){
        this.clock = sinon.useFakeTimers();
        // useFakeTimers does not fake setImmediate. I make it by hand
        this.setImmediateOriginal = window.setImmediate;
        window.setImmediate = function(fn) {
          setTimeout(fn, 0);
        };

        this.videoPlayer = Subject();
        this.state = getstate(this.videoPlayer);
    	},
    	tearDown: function (){
        this.clock.restore();
        window.setImmediate = this.setImmediateOriginal;
    	}
    } );

    test("from playing to paused", function() {
      this.state.set("playing"); // I start from this state
      this.videoPlayer.trigger("play");
      assert(this.state.get(), "paused");
      this.clock.tick(60);
      assert(this.state.get(), "standby"); // after 60ms I transition to this state
    });
