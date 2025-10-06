import type { HomeAssistant } from "../../types/home-assistant";

export async function startTimer(
  hass: HomeAssistant,
  entityId: string,
  durationSeconds: number,
): Promise<void> {
  await hass.callService("timer", "start", {
    entity_id: entityId,
    duration: durationSeconds,
  });
}

export async function restartTimer(
  hass: HomeAssistant,
  entityId: string,
  durationSeconds: number,
): Promise<void> {
  await hass.callService("timer", "start", {
    entity_id: entityId,
    duration: durationSeconds,
  });
}

export async function changeTimer(
  hass: HomeAssistant,
  entityId: string,
  deltaSeconds: number,
): Promise<void> {
  await hass.callService("timer", "change", {
    entity_id: entityId,
    duration: deltaSeconds,
    action: "add",
  });
}

export async function pauseTimer(hass: HomeAssistant, entityId: string): Promise<void> {
  await hass.callService("timer", "pause", {
    entity_id: entityId,
  });
}

export async function resumeTimer(hass: HomeAssistant, entityId: string): Promise<void> {
  await hass.callService("timer", "start", {
    entity_id: entityId,
  });
}

export async function cancelTimer(hass: HomeAssistant, entityId: string): Promise<void> {
  await hass.callService("timer", "cancel", {
    entity_id: entityId,
  });
}

export function supportsTimerChange(hass: HomeAssistant | undefined): boolean {
  if (!hass?.services) {
    return false;
  }

  const domain = hass.services.timer;
  if (!domain) {
    return false;
  }

  return typeof domain.change !== "undefined";
}

export function supportsTimerPause(hass: HomeAssistant | undefined): boolean {
  if (!hass?.services) {
    return false;
  }

  const domain = hass.services.timer;
  if (!domain) {
    return false;
  }

  return typeof domain.pause !== "undefined";
}
