export type ColorScheme = "light" | "dark";

export const SchemeColors = {
  light: {
    primary: "#00A86B",
    background: "#FFFFFF",
    surface: "#F4F4F4",
    foreground: "#111111",
    muted: "#666666",
    border: "#E0E0E0",
    success: "#00A86B",
    warning: "#F59E0B",
    error: "#E53935"
  },
  dark: {
    primary: "#00C97A",
    background: "#0D0D0D",
    surface: "#1A1A1A",
    foreground: "#F0F0F0",
    muted: "#999999",
    border: "#2A2A2A",
    success: "#00C97A",
    warning: "#FBBF24",
    error: "#FF5252"
  }
} as const;
