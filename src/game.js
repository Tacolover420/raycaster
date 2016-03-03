import _ from './util';
import {Vector} from './vector';
import {Dungeon} from './dungeon';

export class Game {
  constructor(canvas, rows, cols) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rows = rows;
    this.cols = cols;

    this.map = new Dungeon({rows: this.rows, cols: this.cols});

    this.viewedTiles = _.matrix(this.rows, this.cols, 0);

    this.moveSpeed = 5; // movement speed in pixels per second.
    this.rotSpeed = Math.PI; // rotation speed in radians per second.
    this.wallColourX = 'rgb(0, 0, 127)';
    this.wallColourY = 'rgb(0, 0, 255)';

    this.keyCodeMap = {
      37: 'l',
      38: 'f',
      39: 'r',
      40: 'b'
    };

    this.moveDirs = {
      'l': false,
      'f': false,
      'r': false,
      'b': false
    };

    /* Direction of the camera */
    this.dir = new Vector(-1, 0);
    /* Direction (and magnitude) of the camera's (orthogonal) plane */
    this.plane = new Vector(0, 0.66);
  }

  go() {
    this.setUp();

    this.map.generate();

    this.pos = this.map.randPos();

    this.lastFrameT = Date.now();
    this.loop();
  }

  setUp() {
    this.canvas.width = 1024;
    this.canvas.height = 512;
    window.document.body.style.margin = 0;

    window.addEventListener('keydown', e => {
      this.moveDirs[this.keyCodeMap[e.keyCode]] = true;
    }, false);

    window.addEventListener('keyup', e => {
      this.moveDirs[this.keyCodeMap[e.keyCode]] = false;
    }, false);
  }

  loop() {
    requestAnimationFrame(this.loop.bind(this));

    var now = Date.now();
    var delta = now - this.lastFrameT;

    this.fps = 1000 / delta;

    this.update(delta / 1000);
    this.render();

    this.lastFrameT = now;
  }

  update(t) {
    if (this.moveDirs.f) {
      /* Walk forwards */
      this.walk(this.dir, t);
    }

    if (this.moveDirs.b) {
      /* Walk backwards */
      this.walk(this.dir.scaledBy(-1), t);
    }

    if (this.moveDirs.r) {
      /* Rotate clockwise */
      this.dir.rotate(-this.rotSpeed * t);
      this.plane.rotate(-this.rotSpeed * t);
    }

    if (this.moveDirs.l) {
      /* Rotate counterclockwise */
      this.dir.rotate(this.rotSpeed * t);
      this.plane.rotate(this.rotSpeed * t);
    }
  }

  walk(dir, t) {
    var newPos = this.pos.plus(dir.scaledBy(this.moveSpeed * t));
    if (this.map.inBounds(newPos) &&
        !this.map.isWall(newPos.map(Math.floor))) {
      this.pos = newPos;
    }
  }

  render() {
    var blockSize, mapW, mapH, w, h, r0, c0, r, c;

    this.ctx.fillStyle = 'rgb(127, 127, 127)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.cast();

    blockSize = 3;
    mapW = blockSize * this.cols;
    mapH = blockSize * this.rows;

    w = this.canvas.width;
    h = this.canvas.height;

    c0 = w - mapW;
    r0 = h - mapH;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(c0, r0, mapW, mapH);

    for (r = 0; r < this.viewedTiles.length; ++r) {
      for (c = 0; c < this.viewedTiles[0].length; ++c) {
        if (this.viewedTiles[r][c] !== 0 && !this.map.isWall(new Vector(r, c))) {
          this.ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
          this.ctx.fillRect(c0 + c * blockSize, r0 + r * blockSize, blockSize, blockSize);
        }
      }
    }

    this.ctx.fillStyle = 'rgb(255, 0, 0)';
    this.ctx.fillRect(c0 + this.pos.y * blockSize, r0 + this.pos.x * blockSize, blockSize, blockSize);
  }

  cast() {
    var rayDir, gridPos, gridDistX, gridDistY, distNextGridX, distNextGridY,
        stepX, stepY, side, wallDist, lineHeight, lineStart, lineEnd;
    var canvas = this.canvas;
    var pos = this.pos;
    var dir = this.dir;
    var plane = this.plane;

    for (var x = 0; x < canvas.width; ++x) {
      rayDir = dir.plus(plane.scaledBy(2 * x / canvas.width - 1));
      /* `--> Note: the scaling factor is always in [-1, 1]. */

      gridPos = pos.map(Math.floor);
      /* `--> Which box of the map we're in */

      /* Length along ray from any x or y grid line to the next. */
      gridDistX = Math.sqrt(1 + (rayDir.y * rayDir.y) / (rayDir.x * rayDir.x));
      gridDistY = Math.sqrt(1 + (rayDir.x * rayDir.x) / (rayDir.y * rayDir.y));

      /* Figure out step and initial grid distances. */
      if (rayDir.x < 0) {
        stepX = -1;
        distNextGridX = (pos.x - gridPos.x) * gridDistX;
      } else {
        stepX = 1;
        distNextGridX = (gridPos.x + 1 - pos.x) * gridDistX;
      }

      if (rayDir.y < 0) {
        stepY = -1;
        distNextGridY = (pos.y - gridPos.y) * gridDistY;
      } else {
        stepY = 1;
        distNextGridY = (gridPos.y + 1 - pos.y) * gridDistY;
      }

      while (true) {
        /* Keep jumping in the direction of `rayDir` to the next gridline until a
         * wall is found.
         */
        if (distNextGridX < distNextGridY) {
          distNextGridX += gridDistX;
          gridPos.x += stepX;
          side = 'X';
        } else {
          distNextGridY += gridDistY;
          gridPos.y += stepY;
          side = 'Y';
        }

        this.viewedTiles[gridPos.x][gridPos.y] = 1;

        if (this.map.isWall(gridPos)) {
          break;
        }
      }

      /* Calculate the distance of the wall **along the current direction**.
       * This is done to avoid the fish eye effect.
       */

      /* FIXME: vector calculation missing the (1 - step) / 2 term, causing
       * "chunky" effect. Rewrite this and/or findWall to make it work. */
      //var wallDist = wall.pos.minus(pos).projected(dir).magnitude();

      if (side === 'X') {
        wallDist = Math.abs((gridPos.x - pos.x + (1 - stepX) / 2) / rayDir.x);
      } else {
        wallDist = Math.abs((gridPos.y - pos.y + (1 - stepY) / 2) / rayDir.y);
      }

      /* Calculate how high this strip of the wall should appear (in pixels). */
      lineHeight = Math.abs(Math.floor(canvas.height / wallDist));

      lineStart = Math.max((canvas.height - lineHeight) / 2, 0);
      lineEnd = Math.min((lineHeight + canvas.height) / 2, canvas.height - 1);

      /* Draw the line */
      this.ctx.beginPath();
      this.ctx.moveTo(x, lineStart);
      this.ctx.lineTo(x, lineEnd);
      this.ctx.strokeStyle = side === 'X' ? this.wallColourX : this.wallColourY;
      this.ctx.stroke();
    }
  }
}

