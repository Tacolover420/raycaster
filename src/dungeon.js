import _ from './util';
import {Vector} from './vector';
import {Room} from './room';

export class Dungeon {
  constructor(settings={}) {
    this.opts = {
      rows: 101,
      cols: 101,
      /* The probability that a maze will extend in a random direction at any
       * given step.
       * Must be in the interval [0, 1].
       * Higher number -> more twists and turns in the mazes.
       */
      curliness: 0.2,

      /* The probability that an unneeded connector will be placed. */
      extraConnectorChance: 0.02,

      /* The probability that a given dead end path will remain. */
      deadEndiness: 0,

      /* The bounds for the side lengths of rooms. */
      minRoomSize: 5,
      maxRoomSize: 9,

      /* The number of times the algorithm will try to place a
       * randomly-generated room on the grid.
       */
      roomPlacementAttempts: 10,

      /* Codes for the three types of tiles.
       * Empty tiles represent the 'blank canvas' on which the dungeon is drawn.
       * Floor tiles are used to represent rooms and hallways.
       * Connector tiles are used to connect rooms and hallways together.
       */
      wallTile: 0,
      floorTile: 1,
      connectorTile: 2
    };

    _.merge(this.opts, settings);

    this.grid = _.matrix(this.opts.rows, this.opts.cols, this.opts.wallTile);
    this.regions = _.matrix(this.opts.rows, this.opts.cols, null);

    this.currentRegion = -1;

    this.rooms = [];

    this.generated = false;
  }

  inBounds(coords) {
    return _.inRange(coords.x, this.opts.rows) &&
           _.inRange(coords.y, this.opts.cols);
  }

  /* Return a coordinate Vector representing the middle of a random room. */
  randPos() {
    var room;

    this.checkGenerated();

    /* The rooms are generated randomly anyway, so we can just return the first
     * one generated.
     */
    room = this.rooms[0];
    return room.topLeft.plus(room.bottomRight.minus(room.topLeft).scaledBy(0.5));
  }

  traverse() {
    var topLeft, bottomRight, f, i, j, v;

    if (arguments.length === 1) {
      topLeft = new Vector(0, 0);
      bottomRight = new Vector(this.opts.rows - 1, this.opts.cols - 1);
      f = arguments[0];
    } else if (arguments.length === 3) {
      topLeft = arguments[0];
      bottomRight = arguments[1];

      this.checkBounds(topLeft);
      this.checkBounds(bottomRight);

      f = arguments[2];
    } else {
      throw RangeError('Dungeon.prototype.traverse either takes one function ' +
                       'or two vectors and a function as arguments.');
    }

    v = new Vector(0, 0);

    for (i = topLeft.x; i <= bottomRight.x; ++i) {
      for (j = topLeft.y; j <= bottomRight.y; ++j) {
        v.x = i;
        v.y = j;
        f(v);
      }
    }
  }

  prettyPrint() {
    var s = '';
    for (var i = 0; i < this.opts.rows; ++i) {
      for (var j = 0; j < this.opts.cols; ++j) {
        switch (this.grid[i][j]) {
          case this.opts.wallTile:
            s +=  ' ';
            break;
          case this.opts.floorTile:
            s +=  '*';
            break;
          case this.opts.connectorTile:
            s +=  '#';
            break;
        }
      }
      s += '\n';
    }
    return s;
  }

  /* An implementation of the dungeon generation algorithm from
   * http://journal.stuffwithstuff.com/2014/12/21/rooms-and-mazes/
   */
  generate() {
    if (this.generated)
      throw 'This Dungeon has already been generated.';

    /* First, randomly place some randomly-generated rooms. */
    this.placeRooms();
    /* Spawn random mazes in between the rooms, filling all empty space. */
    this.fillMazes();
    /* Connect the rooms and mazes together, such that there is at least one
     * path through the dungeon from every point to every other.
     */
    this.connectRegions();
    /* At this point, the entire dungeon is filled with rooms and mazes, most
     * of which are dead ends. Fill some (or all) of the dead ends back in.
     */
    this.eliminateDeadEnds();

    this.generated = true;
  }

  placeRooms() {
    var attempts = this.opts.roomPlacementAttempts;
    while (attempts > 0) {
      var topLeft = new Vector(_.randOdd(1, this.opts.rows - 2),
                               _.randOdd(1, this.opts.cols - 2));

      var w = _.randOdd(this.opts.minRoomSize, this.opts.maxRoomSize);
      var h = _.randOdd(this.opts.minRoomSize, this.opts.maxRoomSize);

      var bottomRight = new Vector(topLeft.x + h - 1, topLeft.y + w - 1);
      var newRoom = new Room(topLeft, bottomRight);

      var intersection = _.some(this.rooms, room => room.intersects(newRoom));

      if (!intersection && this.inBounds(bottomRight)) {
        ++this.currentRegion;
        this.rooms.push(newRoom);
        this.traverse(newRoom.topLeft, newRoom.bottomRight, coords =>
          this.setFloorTile(coords, this.opts.floorTile)
        );
      }

      --attempts;
    }
  }

  fillMazes() {
    var coords, r, c;
    for (r = 1; r < this.opts.rows; r += 2) {
      for (c = 1; c < this.opts.cols; c += 2) {
        coords = new Vector(r, c);
        if (this.tileAt(coords) === this.opts.wallTile) {
          ++this.currentRegion;
          this.spawnMaze(coords);
        }
      }
    }
  }
  /* An implementation of the "Growing Tree" maze generation algorithm from
   * http://weblog.jamisbuck.org/2011/1/27/maze-generation-growing-tree-algorithm
   *
   * Essentially, we slither around in random directions, filling in tiles as we
   * go. Once we hit a dead end, we jump to a tile we've already visited and
   * branch out from there. Once we've branched from every visited tile, we stop.
   */
  spawnMaze(coords) {
    var c, canGoSameDir, dir, emptyDirs, twoTilesAway;

    var liveCells = [];

    var lastDir = null;

    this.setFloorTile(coords, this.opts.floorTile);

    liveCells.push(coords);

    while (liveCells.length > 0) {
      c = _.last(liveCells);

      /* Directions in which adjacent tile is empty. */
      emptyDirs = _.filter(this.validDirectionsFrom(c, 2), dir =>
        this.isEmptyAround(c.plus(dir.scaledBy(2)))
      );

      if (emptyDirs.length > 0) {
        /* Since there's at least one adjacent empty tile, we can extend the
         * maze.
         */
        canGoSameDir = lastDir !== null && _.some(emptyDirs, dir =>
          dir.eq(lastDir)
        );
        if (canGoSameDir && Math.random() > this.opts.curliness) {
          dir = lastDir;
        } else {
          dir = _.sample(emptyDirs);
        }

        if (this.inBounds(c.plus(dir)))
          this.setFloorTile(c.plus(dir), this.opts.floorTile);

        twoTilesAway = c.plus(dir.scaledBy(2));

        if (this.inBounds(twoTilesAway)) {
          this.setFloorTile(twoTilesAway, this.opts.floorTile);
          liveCells.push(twoTilesAway);
        }

        lastDir = dir;

      } else {
        /* We've hit a dead end; backtrack. */
        liveCells.pop();
        lastDir = null;
      }
    }
  }

  /* Connect the (as yet disconnected) rooms and mazes. Lifted from
   * https://github.com/munificent/hauberk/blob/db360d9efa714efb6d937c31953ef849c7394a39/lib/src/content/dungeon.dart#L173
   */
  connectRegions() {
    var connectorMap, connectors, r, c, coords, neighbours, regions, i, region,
        merged, independentRegions, connector, dest, sources, validConnectors;

    connectorMap = {};
    connectors = [];
    for (r = 1; r < this.opts.rows - 1; ++r) {
      for (c = 1; c < this.opts.cols - 1; ++c) {
        coords = new Vector(r, c);
        if (this.tileAt(coords) === this.opts.wallTile) {
          neighbours = this.neighbours(coords);
          regions = [];
          for (i = 0; i < neighbours.length; ++i) {
            region = this.regions[neighbours[i].x][neighbours[i].y];
            if (region !== null && !_.includes(regions, region))
              regions.push(region);
          }

          if (regions.length >= 2) {
            connectorMap[coords.toString()] = regions;
            connectors.push(coords);
          }
        }
      }
    }

    merged = {};
    independentRegions = [];
    for (i = 0; i <= this.currentRegion; ++i) {
      merged[i] = i;
      independentRegions.push(i);
    }

    while (independentRegions.length > 1) {
      connector = connectors[0];
      this.setConnector(connector);

      regions = _.map(connectorMap[connector.toString()], region =>
          merged[region]
      );
      dest = regions[0];
      sources = regions.slice(1);

      for (i = 0; i <= this.currentRegion; ++i) {
        if (_.includes(sources, merged[i])) {
          merged[i] = dest;
        }
      }

      independentRegions = _.reject(independentRegions, region =>
        _.includes(sources, region)
      );

      /* Filter out connectors that no longer connect two or more regions. */
      validConnectors = _.filter(connectors, function(coords) {
        var regions = _.map(connectorMap[coords.toString()], region =>
          merged[region]
        );
        var uniqueRegions = new Set(regions);
        if (uniqueRegions.size > 1)
          return true;
        if (Math.random() < this.opts.extraConnectorChance)
          this.setConnector(coords);
        return false;
      }.bind(this));
      connectors = validConnectors;
    }
  }

  eliminateDeadEnds() {
    var r, c, coords, exits;
    var done = false;
    while (!done) {
      done = true;
      for (r = 0; r < this.opts.rows; ++r) {
        for (c = 0; c < this.opts.cols; ++c) {
          coords = new Vector(r, c);
          if (this.tileAt(coords) !== this.opts.wallTile) {
            exits = _.filter(this.neighbours(coords), neighbour =>
              !this.isWall(neighbour)
            );
            if (exits.length === 1) {
              done = false;
              this.eraseTileAt(coords);
            }
          }
        }
      }
    }
  }

  tileAt(coords) {
    this.checkBounds(coords);
    return this.grid[coords.x][coords.y];
  }

  isWall(coords) {
    return this.tileAt(coords) === this.opts.wallTile;
  }

  setFloorTile(coords, value) {
    this.checkBounds(coords);
    this.grid[coords.x][coords.y] = value;
    this.regions[coords.x][coords.y] = this.currentRegion;
  }

  setConnector(coords) {
    this.checkBounds(coords);
    this.grid[coords.x][coords.y] = this.opts.connectorTile;
  }

  eraseTileAt(coords) {
    this.checkBounds(coords);
    this.grid[coords.x][coords.y] = this.opts.wallTile;
  }

  checkBounds(coords) {
    if (!this.inBounds(coords)) {
      throw RangeError("This dungeon doesn't have a cell at (" +
                       coords.x + ', ' + coords.y + ').');
    }
  }

  checkGenerated() {
    if (!this.generated)
      throw 'Forgot to call Dungeon.generate()!';
  }

  isEmptyAround(coords) {
    return this.isWall(coords) && _.every(this.validDirectionsFrom(coords), d =>
      this.isWall(coords.plus(d))
    );
  }

  validDirectionsFrom(coords, steps=1) {
    var directions = [
      new Vector(1, 0), /* north */
      new Vector(-1, 0), /* south */
      new Vector(0, -1), /* west */
      new Vector(0, 1), /* east */
    ];
    return _.filter(directions, dir =>
      this.inBounds(coords.plus(dir.scaledBy(steps)))
    );
  }

  neighbours(coords) {
    var validDirections = this.validDirectionsFrom(coords);
    return _.map(validDirections, dir => coords.plus(dir));
  }
}

