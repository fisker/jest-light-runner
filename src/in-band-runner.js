import { Piscina } from "piscina";
import Runner from "./runner.js";
import InBandPiscina from "./in-band-piscina.js";

/** @typedef {import("@jest/test-result").Test} Test */

export default class InBandLightRunner extends Runner {
  constructor(config) {
    super(config, InBandPiscina);
  }
}
