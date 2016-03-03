export class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  toString() {
    return `[${this.x}, ${this.y}]`;
  }

  copy() {
    return new Vector(this.x, this.y);
  }

  eq(v) {
    return (this.x === v.x) && (this.y === v.y);
  }

  neq(v) {
    return !this.eq(v);
  }

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalized() {
    var m = this.magnitude();
    if (m === 0) {
      throw new RangeError("Can't normalize the zero vector!");
    }
    return new Vector(this.x / m, this.y / m);
  }

  scaledBy(n) {
    return new Vector(this.x * n, this.y * n);
  }

  map(f) {
    return new Vector(f(this.x), f(this.y));
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
  }

  rotate(theta) {
    var oldX = this.x;
    this.x = this.x * Math.cos(theta) - this.y * Math.sin(theta);
    this.y = oldX * Math.sin(theta) + this.y * Math.cos(theta);
  }

  plus(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  minus(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  distanceFrom(v) {
    return this.minus(v).magnitude();
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  projectedOnto(v) {
    return v.normalized().scaledBy(this.dot(v.normalized()));
  }
}

