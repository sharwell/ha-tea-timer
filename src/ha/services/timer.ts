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
  await hass.callService("timer", "cancel", { entity_id: entityId });
  await hass.callService("timer", "start", {
    entity_id: entityId,
    duration: durationSeconds,
  });
}
