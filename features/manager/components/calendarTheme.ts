import type { CSSProperties } from "react";

/**
 * Tema visual dos calendários (NEVIM). Usado por `DatePicker` e
 * `DateTimePicker` junto com `calendar.css` (sobrescreve o `style.css` base
 * do react-day-picker).
 */
export const calendarVars = {
  "--rdp-accent-color": "#378ADD",
  "--rdp-accent-background-color": "#E6F1FB",
  "--rdp-today-color": "#0C447C",
  "--rdp-selected-border": "2px solid #0C447C",
  "--rdp-disabled-opacity": 0.35,
  "--rdp-outside-opacity": 0.4,
  "--rdp-dropdown-gap": "0.5rem",
} as CSSProperties;
