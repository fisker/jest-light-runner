import { Piscina } from "piscina";
import Runner from "./runner.js";
import InBandPiscina from "./in-band-piscina.js";

/** @typedef {import("@jest/test-result").Test} Test */

export default class LightRunner extends Runner {
  constructor(config) {
    // Jest's logic to decide when to spawn workers and when to run in the
    // main thread is quite complex:
    //  https://github.com/facebook/jest/blob/5183c1/packages/jest-core/src/testSchedulerHelper.ts#L13
    // We will only run in the main thread when `maxWorkers` is 1.
    // It's always 1 when using the `--runInBand` option.
    // This is so that the tests shares the same global context as Jest only
    // when explicitly required, to prevent them from accidentally interferring
    // with the test runner. Jest's default runner does not have this problem
    // because it isolates every test in a vm.Context.
    const runInBand = config.maxWorkers === 1;
    super(config, runInBand ? InBandPiscina : Piscina);
  }
}
