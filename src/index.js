import Tinypool from "tinypool";
import supportsColor from "supports-color";
import pLimit from "p-limit";

/** @typedef {import("@jest/test-result").Test} Test */

const createRunner = ({ runtime = "worker_threads" } = {}) =>
  class LightRunner {
    // TODO: Use real private fields when we drop support for Node.js v12
    _config;
    _pool;
    _isProcessRunner = runtime === "child_process";
    _runInBand = false;

    constructor(config) {
      this._config = config;

      // Jest's logic to decide when to spawn workers and when to run in the
      // main thread is quite complex:
      //  https://github.com/facebook/jest/blob/5183c1/packages/jest-core/src/testSchedulerHelper.ts#L13
      // We will only run in the main thread when `maxWorkers` is 1.
      // It's always 1 when using the `--runInBand` option.
      // This is so that the tests shares the same global context as Jest only
      // when explicitly required, to prevent them from accidentally interfering
      // with the test runner. Jest's default runner does not have this problem
      // because it isolates every test in a vm.Context.
      const { maxWorkers } = config;
      const runInBand = maxWorkers === 1;
      const env =
        runInBand || this._isProcessRunner
          ? process.env
          : {
              // Workers don't have a tty; we want them to inherit
              // the color support level from the main thread.
              FORCE_COLOR: supportsColor.stdout.level,
              ...process.env,
            };

      this._runInBand = runInBand;
      this._pool = new (runInBand ? InBandTinypool : Tinypool)({
        filename: new URL("./worker-runner.js", import.meta.url).href,
        runtime,
        minThreads: maxWorkers,
        maxThreads: maxWorkers,
        env,
        trackUnmanagedFds: false,
      });
    }

    /**
     * @param {Array<Test>} tests
     * @param {*} watcher
     * @param {*} onStart
     * @param {*} onResult
     * @param {*} onFailure
     */
    async runTests(tests, watcher, onStart, onResult, onFailure) {
      const pool = this._pool;
      const { updateSnapshot, testNamePattern, maxWorkers } = this._config;
      const isProcessRunner = !this._runInBand && this._isProcessRunner;

      const mutex = pLimit(maxWorkers);

      await Promise.all(
        tests.map(test =>
          mutex(() =>
            onStart(test)
              .then(() => pool.run({ test, updateSnapshot, testNamePattern }))
              .then(result => onResult(test, result))
              .catch(error => onFailure(test, error)),
          ),
        ),
      );

      if (isProcessRunner) {
        for (const { process } of pool.threads) {
          // Use `process.disconnect()` instead of `process.kill()`, so we can collect coverage
          // See https://github.com/nicolo-ribaudo/jest-light-runner/issues/90#issuecomment-2812473389
          // Only override the first call https://github.com/tinylibs/tinypool/blob/dbf6d74282dd6031df8fc5c7706caef66b54070b/src/runtime/process-worker.ts#L61
          const originalKill = process.kill;
          process.kill = signal => {
            if (!signal) {
              process.disconnect();
              process.kill = originalKill;
              return;
            }
            return originalKill.call(process, signal);
          };
        }

        await pool.destroy();
      }
    }
  };

// Exposes an API similar to Tinypool, but it uses dynamic import()
// rather than worker_threads.
class InBandTinypool {
  _moduleP;
  _moduleDefault;

  constructor({ filename }) {
    this._moduleP = import(filename);
  }

  async run(data) {
    if (!this._moduleDefault) {
      this._moduleDefault = (await this._moduleP).default;
    }

    return this._moduleDefault(data);
  }
}

export default createRunner();
export { createRunner };
