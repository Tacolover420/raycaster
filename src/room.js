export class Room {
  constructor(topLeft, bottomRight) {
    if (topLeft.x >= bottomRight.x ||
        topLeft.y >= bottomRight.y) {
      throw RangeError('Top left corner of room must be above and to the ' +
                       'left of bottom right corner in grid.');
    }
    this.topLeft = topLeft;
    this.bottomRight = bottomRight;
  }

  intersects(other) {
    /* The rooms intersect if they don't not intersect. */
    return !(
      /* They don't intersect if:
       */
      /* The index of the bottom-most row of one is less than the index of the
       * top-most row of the other.
       */
      this.bottomRight.x < other.topLeft.x ||
      other.bottomRight.x < this.topLeft.x ||
      /* The index of the right-most column of one is less than the index of
       * the left-most column of the other.
       */
      this.bottomRight.y < other.topLeft.y ||
      other.bottomRight.y < this.topLeft.y
    );
  }
}

