import type {
  HassConnection,
  HassEntity,
  HassEventMessage,
  HassStateChangedEvent,
  HassTimerFinishedEvent,
  HassUnsubscribe,
} from "../types/home-assistant";

function createNoopUnsubscribe(): HassUnsubscribe {
  return () => {};
}

function wrapUnsubscribe(unsub: HassUnsubscribe | void | Promise<void>): HassUnsubscribe {
  if (typeof unsub === "function") {
    return unsub;
  }

  if (unsub instanceof Promise) {
    return () => unsub;
  }

  return createNoopUnsubscribe();
}

export async function subscribeTimerFinished(
  connection: HassConnection | undefined,
  entityId: string,
  handler: (event: HassTimerFinishedEvent) => void,
): Promise<HassUnsubscribe> {
  if (!connection) {
    return createNoopUnsubscribe();
  }

  const normalizedEntityId = entityId.toLowerCase();

  const unsubscribe = await connection.subscribeMessage<HassEventMessage<HassTimerFinishedEvent>>(
    (event) => {
      if (event?.event_type !== "timer.finished") {
        return;
      }

      const eventEntityId = event.data?.entity_id;
      if (typeof eventEntityId !== "string" || eventEntityId.toLowerCase() !== normalizedEntityId) {
        return;
      }

      handler(event.data);
    },
    {
      type: "subscribe_events",
      event_type: "timer.finished",
    },
  );

  return wrapUnsubscribe(unsubscribe);
}

export async function subscribeTimerStateChanges(
  connection: HassConnection | undefined,
  entityId: string,
  handler: (entity: HassEntity | undefined) => void,
): Promise<HassUnsubscribe> {
  if (!connection) {
    return createNoopUnsubscribe();
  }

  const normalizedEntityId = entityId.toLowerCase();

  const unsubscribe = await connection.subscribeMessage<HassEventMessage<HassStateChangedEvent>>(
    (event) => {
      if (event?.event_type !== "state_changed") {
        return;
      }

      const eventEntityId = event.data?.entity_id;
      if (typeof eventEntityId !== "string" || eventEntityId.toLowerCase() !== normalizedEntityId) {
        return;
      }

      handler(event.data?.new_state ?? undefined);
    },
    {
      type: "subscribe_events",
      event_type: "state_changed",
    },
  );

  return wrapUnsubscribe(unsubscribe);
}
