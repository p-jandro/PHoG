/**
 * Timer utility for game countdowns and timing
 */

export class Timer {
  constructor(duration, onTick, onComplete) {
    this.duration = duration; // milliseconds
    this.remaining = duration;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.interval = null;
    this.startTime = null;
    this.isRunning = false;
  }

  /**
   * Start the timer
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    
    // Emit initial tick
    if (this.onTick) {
      this.onTick(this.remaining);
    }

    // Update every 100ms for smooth countdown
    this.interval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      this.remaining = Math.max(0, this.duration - elapsed);

      if (this.onTick) {
        this.onTick(this.remaining);
      }

      if (this.remaining === 0) {
        this.stop();
        if (this.onComplete) {
          this.onComplete();
        }
      }
    }, 100);
  }

  /**
   * Stop the timer
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
  }

  /**
   * Pause the timer
   */
  pause() {
    if (!this.isRunning) return;
    
    this.stop();
    const elapsed = Date.now() - this.startTime;
    this.remaining = Math.max(0, this.duration - elapsed);
  }

  /**
   * Resume the timer
   */
  resume() {
    if (this.isRunning) return;
    
    this.duration = this.remaining;
    this.start();
  }

  /**
   * Reset the timer
   */
  reset() {
    this.stop();
    this.remaining = this.duration;
  }

  /**
   * Get remaining time in seconds
   */
  getRemainingSeconds() {
    return Math.ceil(this.remaining / 1000);
  }

  /**
   * Check if timer is complete
   */
  isComplete() {
    return this.remaining === 0;
  }
}

/**
 * Create a simple countdown timer
 * @param {number} seconds - Duration in seconds
 * @param {function} callback - Called when timer completes
 * @returns {Timer}
 */
export function createCountdown(seconds, callback) {
  return new Timer(seconds * 1000, null, callback);
}

