/**
 * Fixed-capacity ring buffer for in-memory diagnostics.
 *
 * Two flavors:
 *   - RingBuffer: a single flat list (used by the error reporter for the
 *     last N uncaught exceptions / unhandled rejections / fatal logs).
 *   - PlayerRingBuffer: per-key buffers (used when we want the last N events
 *     for a specific player — e.g. "Alice's submission didn't register, show
 *     me her last 50 events"). Not exposed over the network by default.
 *
 * Neither is persisted. They survive only while the process is up; that's
 * fine — these exist to make a live incident debuggable, not to be an
 * audit log.
 */

const DEFAULT_CAPACITY = 100;
const DEFAULT_PER_PLAYER = 50;

export class RingBuffer {
  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = Math.max(1, capacity | 0);
    /** @type {Array<{ ts: number, type: string, payload: object }>} */
    this.entries = [];
  }

  /**
   * Append an entry. Oldest entries fall off when capacity is exceeded.
   */
  push(type, payload = {}) {
    this.entries.push({ ts: Date.now(), type, payload });
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  /** @returns {Array<{ts: number, type: string, payload: object}>} a copy */
  snapshot() {
    return this.entries.slice();
  }

  stats() {
    return { size: this.entries.length, capacity: this.capacity };
  }

  clear() {
    this.entries.length = 0;
  }
}

export class PlayerRingBuffer {
  constructor(capacity = DEFAULT_PER_PLAYER) {
    this.capacity = Math.max(1, capacity | 0);
    /** @type {Map<string, Array<{ ts: number, type: string, payload: object }>>} */
    this.buffers = new Map();
  }

  push(playerId, type, payload = {}) {
    if (!playerId) return;
    let buf = this.buffers.get(playerId);
    if (!buf) {
      buf = [];
      this.buffers.set(playerId, buf);
    }
    buf.push({ ts: Date.now(), type, payload });
    if (buf.length > this.capacity) {
      buf.splice(0, buf.length - this.capacity);
    }
  }

  forPlayer(playerId) {
    return (this.buffers.get(playerId) || []).slice();
  }

  stats() {
    let total = 0;
    for (const buf of this.buffers.values()) total += buf.length;
    return { players: this.buffers.size, totalEvents: total, capacity: this.capacity };
  }

  clear() {
    this.buffers.clear();
  }
}
