import { describe, it, expect } from "vitest";
import { startStair, stepStair } from "./staircase";
describe("staircase", () => {
  it("climbs on correct, holds on wrong, stops after two consecutive wrong", () => {
    let s = startStair(1, 8);
    s = stepStair(s, true);  expect(s.d).toBe(2);
    s = stepStair(s, true);  expect(s.d).toBe(3);
    s = stepStair(s, false); expect(s.d).toBe(3); expect(s.done).toBe(false);
    s = stepStair(s, false); expect(s.done).toBe(true); expect(s.reason).toBe("twoWrong");
    expect(s.ceiling).toBe(2); expect(s.items).toBe(4);
  });
  it("a correct answer resets the wrong counter", () => {
    let s = startStair(1, 8);
    s = stepStair(s, false); s = stepStair(s, true); s = stepStair(s, false);
    expect(s.done).toBe(false);
  });
  it("stops at maxItems and at the top", () => {
    let s = startStair(1, 3);
    s = stepStair(s, true); s = stepStair(s, true); s = stepStair(s, true);
    expect(s.done).toBe(true); expect(s.reason).toBe("maxItems");
    let t = startStair(10, 8); t = stepStair(t, true);
    expect(t.done).toBe(true); expect(t.reason).toBe("topReached"); expect(t.ceiling).toBe(10);
  });
  it("clamps start into 1..10 and fromProfile uses ceiling-1", () => {
    expect(startStair(0, 8).d).toBe(1); expect(startStair(14, 8).d).toBe(10);
    expect(startStair({ fromProfileCeiling: 5 }, 8).d).toBe(4);
    expect(startStair({ fromProfileCeiling: null }, 8).d).toBe(1);
  });

  describe("teachingItems", () => {
    it("wrong answers inside the teaching window don't count toward twoWrong; stops only after two consecutive wrong AFTER the window", () => {
      let s = startStair(1, 8, 2);
      s = stepStair(s, false); expect(s.done).toBe(false); expect(s.consecutiveWrong).toBe(0); expect(s.d).toBe(1);
      s = stepStair(s, false); expect(s.done).toBe(false); expect(s.consecutiveWrong).toBe(0); expect(s.d).toBe(1);
      s = stepStair(s, false); expect(s.done).toBe(false); expect(s.consecutiveWrong).toBe(1);
      s = stepStair(s, false); expect(s.done).toBe(true); expect(s.reason).toBe("twoWrong");
      expect(s.items).toBe(4);
    });

    it("a correct answer inside the teaching window still climbs normally", () => {
      let s = startStair(1, 8, 2);
      s = stepStair(s, false); expect(s.d).toBe(1); expect(s.done).toBe(false);
      s = stepStair(s, true); expect(s.d).toBe(2); expect(s.done).toBe(false); expect(s.consecutiveWrong).toBe(0);
    });

    it("teachingItems: 0 (default) is unchanged from prior behavior", () => {
      let s = startStair(1, 8);
      expect(s.teachingItems).toBe(0);
      s = stepStair(s, false); s = stepStair(s, false);
      expect(s.done).toBe(true); expect(s.reason).toBe("twoWrong");
    });
  });
});

describe("stepUp (slow progression)", () => {
  it("with stepUp 2, difficulty only rises after two correct in a row; a miss resets the streak", () => {
    let s = startStair(3, 10, 0, 2);
    s = stepStair(s, true);  expect(s.d).toBe(3);
    s = stepStair(s, true);  expect(s.d).toBe(4);
    s = stepStair(s, true);  expect(s.d).toBe(4);
    s = stepStair(s, false); expect(s.d).toBe(4); expect(s.done).toBe(false);
    s = stepStair(s, true);  expect(s.d).toBe(4);
    s = stepStair(s, true);  expect(s.d).toBe(5);
    expect(s.ceiling).toBe(4);
  });
  it("stepUp 1 is the old behaviour", () => {
    let s = startStair(1, 8, 0, 1);
    s = stepStair(s, true); expect(s.d).toBe(2);
  });
});

describe("fast lane (ceiling probing while flawless)", () => {
  it("climbs on every fast correct while no miss yet, then falls back to stepUp 2", () => {
    let s = startStair(3, 10, 0, 2);
    s = stepStair(s, true, true);  expect(s.d).toBe(4);   // fast + flawless: immediate climb
    s = stepStair(s, true, true);  expect(s.d).toBe(5);
    s = stepStair(s, true, false); expect(s.d).toBe(5);   // slow correct: fast lane needs fast answers
    s = stepStair(s, true, false); expect(s.d).toBe(6);   // two in a row
    s = stepStair(s, false);       expect(s.d).toBe(6);
    s = stepStair(s, true, true);  expect(s.d).toBe(6);   // after a miss the fast lane is closed
    s = stepStair(s, true, true);  expect(s.d).toBe(7);
  });
  it("fast lane is inactive when stepUp is 1 (diagnostic unchanged)", () => {
    let s = startStair(1, 8, 0, 1);
    s = stepStair(s, true, false); expect(s.d).toBe(2);
  });
});

describe("ease-in (owner decision #19: 'do 7.5 and then 8')", () => {
  const easeStart = () => startStair(5, 8, 0, 2, 10, { knownCeiling: 7 });

  const climbTo8 = () => {
    // 5,5 -> 6; 6,6 -> 7; 7,7 -> 8 (six corrects, fast=false so no fast lane)
    let s = easeStart();
    for (let i = 0; i < 6; i++) s = stepStair(s, true);
    expect(s.d).toBe(8);
    return s;
  };

  it("difficulties at or below the known ceiling behave exactly as before", () => {
    let s = easeStart();
    s = stepStair(s, false); // miss at d5 (<= ceiling 7): counted, no step-down
    expect(s.lastMissFree).toBe(false);
    expect(s.consecutiveWrong).toBe(1);
    expect(s.d).toBe(5);
    s = stepStair(s, false);
    expect(s.done).toBe(true);
    expect(s.reason).toBe("twoWrong");
  });

  // Bug this prevents: her first-ever try at a record difficulty ending the
  // block or costing the streak — the "7.5" free look must cost nothing.
  it("first miss at a personal-record difficulty is free: no count, difficulty holds", () => {
    let s = climbTo8();
    const before = s.consecutiveWrong;
    s = stepStair(s, false);
    expect(s.lastMissFree).toBe(true);
    expect(s.consecutiveWrong).toBe(before);
    expect(s.d).toBe(8);
    expect(s.done).toBe(false);
    expect(s.freeMissDs).toContain(8);
  });

  it("the free miss is once per difficulty: the second miss there is counted and soft-lands one level down", () => {
    let s = startStair(5, 20, 0, 2, 10, { knownCeiling: 7 });
    for (let i = 0; i < 6; i++) s = stepStair(s, true);
    expect(s.d).toBe(8);
    s = stepStair(s, false); // free
    s = stepStair(s, false); // counted -> soft landing
    expect(s.lastMissFree).toBe(false);
    expect(s.consecutiveWrong).toBe(1);
    expect(s.d).toBe(7);    // rebuild win territory
    expect(s.done).toBe(false);
  });

  it("after the soft landing she can win her way back up and gets NO second free miss at the same level", () => {
    let s = climbTo8();
    s = stepStair(s, false); // free at 8
    s = stepStair(s, false); // soft land -> 7
    // 8-item cap: items used = 6 climb + 2 misses = 8 -> block ends by count.
    expect(s.done).toBe(true);
    expect(s.reason).toBe("maxItems");
    // Same journey with a longer block: she returns to 8 with no free miss left.
    let t = startStair(5, 20, 0, 2, 10, { knownCeiling: 7 });
    for (let i = 0; i < 6; i++) t = stepStair(t, true);
    t = stepStair(t, false); // free at 8
    t = stepStair(t, false); // soft land -> 7
    t = stepStair(t, true);
    t = stepStair(t, true);  // back to 8
    expect(t.d).toBe(8);
    t = stepStair(t, false); // counted immediately (free spent) -> soft land
    expect(t.lastMissFree).toBe(false);
    expect(t.d).toBe(7);
  });

  it("two counted misses in a row still end the block (soft landing is not an infinite ladder)", () => {
    let s = startStair(5, 20, 0, 2, 10, { knownCeiling: 7 });
    for (let i = 0; i < 6; i++) s = stepStair(s, true);
    s = stepStair(s, false); // free at 8
    s = stepStair(s, false); // counted, soft land -> 7
    s = stepStair(s, false); // counted miss at 7 -> two in a row
    expect(s.done).toBe(true);
    expect(s.reason).toBe("twoWrong");
  });

  it("teaching-window misses keep their own rule and do not spend the free miss", () => {
    let s = startStair(8, 8, 1, 2, 10, { knownCeiling: 7 });
    s = stepStair(s, false); // item 1 = teaching window: free by the OLD rule
    expect(s.freeMissDs).toHaveLength(0);
    expect(s.consecutiveWrong).toBe(0);
    expect(s.d).toBe(8);
    s = stepStair(s, false); // now the frontier free miss
    expect(s.lastMissFree).toBe(true);
    expect(s.d).toBe(8);
  });

  it("a never-measured genre treats everything above the start as frontier", () => {
    let s = startStair(1, 8, 0, 2, 10, { knownCeiling: null });
    expect(s.frontierBase).toBe(1);
    s = stepStair(s, true);
    s = stepStair(s, true); // -> 2 (frontier)
    s = stepStair(s, false);
    expect(s.lastMissFree).toBe(true);
  });

  it("without easeIn nothing changes: no free miss, no soft landing", () => {
    let s = startStair(5, 8, 0, 2, 10);
    for (let i = 0; i < 6; i++) s = stepStair(s, true);
    expect(s.frontierBase).toBeNull();
    s = stepStair(s, false);
    expect(s.lastMissFree).toBe(false);
    expect(s.consecutiveWrong).toBe(1);
    expect(s.d).toBe(8); // no step-down
  });
});
