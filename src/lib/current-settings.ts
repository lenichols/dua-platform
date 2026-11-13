import { cache } from "react";
import { DEFAULT_SETTINGS, type EventSettings } from "@/lib/event-settings";
import { getCurrentEvent } from "@/server/event";

/**
 * The event's settings, for pages and layout. If the database can't be
 * reached the page still renders, with the defaults.
 */
export const getSettings = cache(async (): Promise<EventSettings> => {
  try {
    return (await getCurrentEvent()).settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
});
