"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type EventSettings } from "@/lib/event-settings";

const EventContext = createContext<EventSettings>(DEFAULT_SETTINGS);

/** Makes the event's settings available to client components. */
export function EventProvider({
  settings,
  children,
}: {
  settings: EventSettings;
  children: ReactNode;
}) {
  return <EventContext.Provider value={settings}>{children}</EventContext.Provider>;
}

/** The event's settings: name, dates, option lists, rubric. */
export function useEvent(): EventSettings {
  return useContext(EventContext);
}
