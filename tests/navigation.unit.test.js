import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  bearingBetweenPoints,
  distanceBetweenCoords,
  readRouteHistory,
} from "../src/routes.js";

const MAIN_SOURCE = new URL("../src/main.js", import.meta.url);

function totalRouteDistance(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) {
    total += distanceBetweenCoords(
      points[index].lat,
      points[index].lng,
      points[index + 1].lat,
      points[index + 1].lng,
    );
  }
  return total;
}

test("distanceBetweenCoords returns zero for identical coordinates", () => {
  assert.equal(distanceBetweenCoords(55.7, 21.1, 55.7, 21.1), 0);
});

test("distanceBetweenCoords stays close to a known one-degree equator distance", () => {
  const distanceKm = distanceBetweenCoords(0, 0, 0, 1);

  assert.ok(distanceKm > 111.1);
  assert.ok(distanceKm < 111.3);
});

test("bearingBetweenPoints returns cardinal bearings", () => {
  assert.equal(bearingBetweenPoints({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 0);
  assert.equal(bearingBetweenPoints({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 90);
  assert.equal(bearingBetweenPoints({ lat: 0, lng: 0 }, { lat: -1, lng: 0 }), 180);
  assert.equal(bearingBetweenPoints({ lat: 0, lng: 0 }, { lat: 0, lng: -1 }), 270);
});

test("route distance is the sum of each segment", () => {
  const points = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 1, lng: 1 },
  ];
  const total = totalRouteDistance(points);

  assert.ok(total > 222.3);
  assert.ok(total < 222.5);
});

test("readRouteHistory returns an empty list and clears corrupted storage", () => {
  const storage = {
    removedKey: null,
    getItem: () => "{not-json",
    removeItem(key) {
      this.removedKey = key;
    },
  };

  assert.deepEqual(readRouteHistory(storage, "routes"), []);
  assert.equal(storage.removedKey, "routes");
});

test("GPX export keeps route points as GPX 1.1 rtept coordinates", async () => {
  const source = await readFile(MAIN_SOURCE, "utf8");

  assert.match(source, /<gpx version="1\.1" creator="Marine Navigator"/);
  assert.match(source, /<rte>/);
  assert.match(source, /<rtept lat="\$\{point\.lat\}" lon="\$\{point\.lng\}" \/>/);
});

test("GPX import accepts route, track, and waypoint coordinate nodes", async () => {
  const source = await readFile(MAIN_SOURCE, "utf8");

  assert.match(source, /querySelectorAll\("rtept, trkpt, wpt"\)/);
  assert.match(source, /Number\(node\.getAttribute\("lat"\)\)/);
  assert.match(source, /Number\(node\.getAttribute\("lon"\)\)/);
  assert.match(source, /Number\.isFinite\(point\.lat\) && Number\.isFinite\(point\.lng\)/);
});
