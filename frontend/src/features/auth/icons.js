/* The icon set moved to shared/ui/icons.js when the dashboard needed it too.
   This re-export keeps every existing `from "./icons"` import working, and
   means there is still exactly one place icons are drawn. Add new ones there. */
export * from "../../shared/ui/icons";
