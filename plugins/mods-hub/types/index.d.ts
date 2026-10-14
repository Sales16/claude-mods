/** The `/config` key of the choice row whose options are listed open, if any. */
export type ModsHubExpanded = string | null

/**
 * Columns the mods pane takes from the transcript while docked beside it; 0
 * while it is closed or inline. The mode line spans both, so a mod drawing
 * there adds this to its viewport's columns.
 */
export type ModsHubDock = number

declare module 'claude-code' {
  interface PluginState {
    'mods-hub': { expanded: ModsHubExpanded; dock: ModsHubDock }
  }
}
