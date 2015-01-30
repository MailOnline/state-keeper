StateKeeper
===========

StateKeeper is a simple but customizable state machine. It observes one or more observables (sorry for the pun) and use their events to transition to different states (a state can be as simple as a string).

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
For each transition (fired by the observable) I have a list of state change.
In this example when the subject fires the event "play" I can change the state from "ready" (the default initial state) to "playing", from "playing" to "paused" and the other way around.
Any other event will be ignored, for example there is no way to getting back to the initial "ready" state.
Let's see what happen when videoPlayer fires events:

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

With "on" you can attach a function when the state change. A stateKeeper instance fires an event called "enter.statename" when it enter in a new state and "leave.statename" when is leaving a state.
There are a few shortcut available:

  - "*.statename" will run the function for "enter.statename" and "leave.statename"
  - "enter.*" will run the function every time it transition to a new state
  - "leave.*" will run the function every time it is leaving a state
  - "*.*" will run the function for any state, when it is entering and leaving
  - omitting the first argument it is equivalent to using "*.*"
  - "statename" is the same as "enter.statename"
  - "*" is the same as "enter.*"

Now you should start realizing how this thing can be useful. With a simple declarative syntax we are able to keep track of the various state of the videoPlayer!

event
-----
Event is the argument passed to the function. It contains 3 properties:

  - type: "enter" or "leave"
  - state: the state
  - event: the original event object that triggered the state change

More complex transition conditions
==================================
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
        from: function (currentState){
          return currentState === "playing" && this.duration === this.currentTime;
        },
        to: 'ended'
      },
      {
        from: function (currentState){
          return currentState === "playing" && this.duration !== this.currentTime;
        },
        to: 'ready'
      }
    ]
  });

In this example I have used a function for deciding if I should transition to the "ended" state.
In case I get a "stop" event from the videoPlayer I check the current state (it is passed as argument to the function).
The function also gets the subject (videoPlayer in this case) as "this", in this example I check if the video is finished playing, in this case I transition to the "ended" state, in the other case I get to the "ready" state.

Initial state
=============
The initial state is the string "ready" by default but you can change it in the options:

  var state = StateKeeper(videoPlayer, {
    ... event/state map
  },
  {
    initialState: "initial"
  });


Using an object
===============
Until now I have used a simple string as event. In reality you could use an object. This will allow to do something a bit more complex:

  var state = StateKeeper(videoPlayer, {
    play: [
      {from:"ready",   to: {name: "playing", number: 1}},
      {from:"playing", to: function (state){return {name: "paused",  number: state.number};}},
      {from:"paused",  to: function (state){return {name: "playing", number: state.number + 1};}}
    ]
  });

  state.on("playing", function (evt){
    console.log("Playing for " + evt.state.number + " times");
  });

A state object is a plain old js object containing a property "name" (this is required). This property will be used any times a string is expected (triggering events, transitioning from string/regexp).
The "from" can also be defined as "object" or as a function taking the previous state as argument.

More than one observable
========================
StateKeeper is able to keep track of many different observables. You can do this passing, instead of a single object, a map of observables (label: observable). You can then use the label for telling what event of what observable you should listen to:

  var state = StateKeeper({video1: videoPlayer1, video2: videoplayer2}, {
    "video1:play": [
      {from:"ready",          to: "video1_playing",
      {from:"video1_playing", to: "ready"},
      {from:"video2_playing", to: "all_playing"},
      {from:"all_playing",    to: "video2_playing"}
    ],
    "video2:play": [
      {from:"ready",          to: "video2_playing",
      {from:"video2_playing", to: "ready"},
      {from:"video1_playing", to: "all_playing"},
      {from:"all_playing",    to: "video1_playing"}
    ]
  });


In this example I am listening to 2 different video players for having available a state that is the combination of them.

destroy
=======
Statekeeper attaches event handlers to do its job. If you don't use it anymore you should call the destroy method for freeing the resources.

bindMethod/unbindMethod
=======================
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
