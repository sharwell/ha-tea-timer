import { describe, expect, it } from "vitest";
import { TimerAnnouncer } from "./TimerAnnouncer";
import { STRINGS } from "../strings";

function createAnnouncer(): TimerAnnouncer {
  const announcer = new TimerAnnouncer(STRINGS);
  announcer.reset();
  return announcer;
}

describe("TimerAnnouncer", () => {
  it("announces actions with speech-formatted durations", () => {
    const announcer = createAnnouncer();
    const message = announcer.announceAction({
      action: "start",
      durationSeconds: 125,
    });
    expect(message).toContain("Timer started");
    expect(message).toContain("2 minutes and 5 seconds");
  });

  it("throttles running announcements according to schedule", () => {
    const announcer = createAnnouncer();
    announcer.beginRun(180);

    expect(announcer.announceRunning(179)).toBeUndefined();
    expect(announcer.announceRunning(160)).toBeUndefined();
    const first = announcer.announceRunning(150);
    expect(first).toContain("remaining");

    expect(announcer.announceRunning(149)).toBeUndefined();
    const second = announcer.announceRunning(120);
    expect(second).toContain("remaining");

    expect(announcer.announceRunning(119)).toBeUndefined();
    const third = announcer.announceRunning(90);
    expect(third).toContain("remaining");
  });

  it("announces every second under ten seconds", () => {
    const announcer = createAnnouncer();
    announcer.beginRun(12);

    expect(announcer.announceRunning(11)).toBeUndefined();
    expect(announcer.announceRunning(10)).toContain("10 seconds");
    expect(announcer.announceRunning(9)).toContain("9 seconds");
    expect(announcer.announceRunning(8)).toContain("8 seconds");
  });

  it("returns a single announcement per queued preset change", () => {
    const announcer = createAnnouncer();
    const first = announcer.announceQueuedPreset({
      id: 1,
      label: "Green",
      durationSeconds: 180,
      isCustom: false,
    });
    expect(first).toContain("Green");

    const repeat = announcer.announceQueuedPreset({
      id: 1,
      label: "Green",
      durationSeconds: 180,
      isCustom: false,
    });
    expect(repeat).toBeUndefined();

    const second = announcer.announceQueuedPreset({
      id: "custom",
      durationSeconds: 210,
      isCustom: true,
    });
    expect(second).toContain("custom");
  });

  it("announces finishing durations", () => {
    const announcer = createAnnouncer();
    const message = announcer.announceFinished(65);
    expect(message).toContain("1 minute and 5 seconds");
  });
});
