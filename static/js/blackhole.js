Class(function Grid() {
  Inherit(this, Controller);
  var _this = this;
  var $container;
  var _stage, _renderer, _layout;

  //*** Constructor
  (function() {
    Mouse.capture();
    initContainer();
    initPixi();
    initLeap();
    addListeners();
    initViews();
    Render.startRender(loop);
  })();

  var Y = {
    mapToScreen: function(ag, af, Z, ak) {
      var ab = ag[0];
      var aa = ag[1];
      var aj = af[0],
        ai = af[1],
        ae = af[2];
      var ah, ad, ac;
      aj = (aj <= ab.x) ? ab.x : aj;
      aj = (aj > aa.x) ? aa.x : aj;
      ai = (ai <= ab.y) ? ab.y : ai;
      ai = (ai > aa.y) ? aa.y : ai;
      ae = (ae <= ab.z) ? ab.z : ae;
      ae = (ae > aa.z) ? aa.z : ae;
      if (aj <= 0) {
        ah = (1 - (aj / ab.x)) * Z * 0.5
      } else {
        ah = Z * 0.5 + (aj / aa.x) * Z * 0.5
      }
      ad = (1 - (ai / aa.y)) * (ak * 1.25);
      ac = ae;
      return {
        x: ah,
        y: ad,
        z: ac
      }
    }
  };

  function initLeap() {
    var scale = Stage.width / Stage.height;
    var J = new Leap.Controller({
      enableGestures: true
    });
    
    J.on("connect", function() {
      console.log("Connect");
    });

    J.loop(function(frame) {
      if (frame.valid && frame.pointables.length > 0) {
        var pointable = frame.pointables[0];
        Mouse.x = ((pointable.tipPosition[0] * scale) + Stage.width / 2);
        Mouse.y = (Stage.height - pointable.tipPosition[1] * scale);
      } else {
        Mouse.x = (Stage.width / 2);
        Mouse.y = (Stage.height / 2);
      }
    });

  }

  function initContainer() {
    $container = _this.container;
    $container.size('100%').bg('#000');
    Stage.add($container);

    if (Mobile.phone && Stage.width > 768) {
      Mobile.phone = false;
      Mobile.tablet = true;
    }
  }

  function initPixi() {
    _stage = new PIXI.Stage();
    _renderer = new PIXI.WebGLRenderer(Stage.width, Stage.height);
    $container.add(_renderer.view);
  }

  function initViews() {
    _layout = _this.initClass(GridLayout);
    _stage.addChild(_layout.sprite);
  }

  function loop() {
    _renderer.render(_stage);
  }

  //*** Event handlers
  function addListeners() {
    _this.events.subscribe(HydraEvents.RESIZE, resizeHandler);
  }

  function resizeHandler() {
    _renderer.resize(Stage.width, Stage.height);
    _stage.removeChild(_layout.sprite);
    _layout.resize();
    _stage.addChild(_layout.sprite);
  }

  //*** Public methods

});

Class(function GridLayout() {
  Inherit(this, Component);
  var _this = this;
  var _rgb, _texture;

  var _items = new LinkedList();

  this.sprite = new PIXI.DisplayObjectContainer();

  //*** Constructor
  (function() {
    Global.HUE = 0;
    Global.SATURATION = 0;
    Global.RADIUS = 100;

    initTexture();
    initFilters();
    initGrid();
    addListeners();
    Render.startRender(loop);

    Mouse.x = Stage.width / 2;
    Mouse.y = Stage.height / 2;
    touchEnd();
  })();

  function initFilters() {
    _rgb = new PIXI.RGBSplitFilter();
    _rgb.uniforms.red.value = {
      x: 1,
      y: 3
    };
    _rgb.uniforms.green.value = {
      x: 2,
      y: 2
    };
    _rgb.uniforms.blue.value = {
      x: 4,
      y: 1
    };
  }

  function initTexture() {
    var canvas = new Canvas(50, 50);
    var context = canvas.context;
    context.fillStyle = '#fff';
    context.fillRect(0, 12, 12, 12);
    context.fillRect(12, 0, 12, 12);

    _texture = PIXI.Texture.fromCanvas(canvas.div);
  }

  function initGrid() {
    var graphics = new PIXI.Graphics();
    graphics.beginFill(0x0000, 1);
    graphics.drawRect(0, 0, Stage.width, Stage.height);
    graphics.endFill();
    _this.sprite.addChild(graphics);

    var spacing = Mobile.tablet ? 30 : 25;
    var perc = Mobile.phone ? 1.6 : 1.3;
    var numX = Stage.width * perc / spacing;
    var numY = Stage.height * perc / spacing;
    var offsetX = Stage.width * (Mobile.phone ? 0.3 : 0.1);
    var offsetY = Stage.height * (Mobile.phone ? 0.25 : 0.15);
    for (var x = 0; x < numX; x++) {
      for (var y = 0; y < numY; y++) {
        var px = spacing * x;
        var py = spacing * y;
        var item = new GridItem(px - offsetX, py - offsetY, _texture);
        _this.sprite.addChild(item.sprite);
        _items.push(item);
      }
    }

    if (!Device.mobile) _this.sprite.filters = [_rgb];
  }

  function loop(t) {
    var hue = Mouse.x / Stage.width;
    var sat = Utils.convertRange(Mouse.y / Stage.height, 0, 1, 0.3, 0.6);
    Global.HUE += (hue - Global.HUE) * 0.2;
    Global.SATURATION += (sat - Global.SATURATION) * 0.2;

    var i = _items.start();
    while (i) {
      i.update(Mouse);
      i = _items.next();
    }
  }

  //*** Event handlers
  function addListeners() {
    Stage.bind('touchend', touchEnd);
  }

  function touchEnd() {
    Global.RADIUS = 200;
    setTimeout(function() {
      Global.RADIUS = 100;
    }, 100);
  }

  //*** Public methods
  this.resize = function() {
    _this.sprite = new PIXI.DisplayObjectContainer();
    _items.empty();
    initGrid();
  }
});

Class(function GridItem(_x, _y, _texture) {
  Inherit(this, Component);
  var _this = this;

  var SPRING = 0.1;
  var FRICTION = 0.92;
  var RADIUS = 100;

  var _color = new Color();

  var _target = new Vector2();
  var _vec = new Vector2();
  var _origin = new Vector2(_x, _y);

  this.sprite = null;

  this.position = new Vector2(_x, _y);
  this.velocity = new Vector2();

  //*** Constructor
  (function() {
    initSprite();
  })();

  function initSprite() {
    _this.sprite = new PIXI.Sprite(_texture);
    _this.sprite.position.x = _x;
    _this.sprite.position.y = _y;
    _this.sprite.anchor.x = _this.sprite.anchor.y = 0.5;
    _this.sprite.width = _this.sprite.height = Mobile.tablet ? 12 : 9;
    _this.sprite.blendMode = PIXI.blendModes.ADD;
  }

  //*** Event handlers

  //*** Public methods
  this.update = function(touch) {
    _vec.copyFrom(_this.position).sub(touch);
    var dist = _vec.length();

    var radius = Global.RADIUS;
    if (Mobile.phone) radius /= 2;
    if (Mobile.tablet) radius /= 1.5;

    var angle = Math.atan2(_vec.y, _vec.x);
    var amount = Utils.clamp(Utils.convertRange(dist, 0, radius, 100, 0), -100, 100);
    _target.copyFrom(_origin).addAngleRadius(angle, amount);

    _vec.copyFrom(_target).sub(this.position);
    _vec.multiply(SPRING);

    this.velocity.add(_vec);
    this.position.add(this.velocity);
    this.velocity.multiply(FRICTION);

    _vec.copyFrom(_this.position).sub(_origin);
    dist = _vec.length();
    var hue = Utils.clamp(Utils.convertRange(dist, 0, 300, Global.HUE - 0.1, Global.HUE + 0.4), 0, 1.2);
    _color.setHSL(hue, Global.SATURATION, 0.4);
    _this.sprite.tint = _color.getHex();

    this.position.copyTo(this.sprite.position);
  }
});

window.onload = function() {
  new Grid();
}