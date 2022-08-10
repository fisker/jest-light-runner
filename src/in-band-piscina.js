// Exposes an API similar to Piscina, but it uses dynamic import()
// rather than worker_threads.
class InBandPiscina {
  _moduleP;
  _moduleDefault;

  _queue = [];
  _running = false;

  constructor({ filename }) {
    this._moduleP = import(filename);
  }

  run(data) {
    return new Promise((resolve, reject) => {
      this._queue.push({ data, resolve, reject });
      this._runQueue();
    });
  }

  async _runQueue() {
    if (this._running) return;
    this._running = true;

    try {
      if (!this._moduleDefault) {
        this._moduleDefault = (await this._moduleP).default;
      }

      while (this._queue.length > 0) {
        const { data, resolve, reject } = this._queue.shift();
        await this._moduleDefault(data).then(resolve, reject);
      }
    } finally {
      this._running = false;
    }
  }
}

export default InBandPiscina;
