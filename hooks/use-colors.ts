import { SchemeColors } from "@/constants/theme";
import { useThemeContext } from "@/lib/theme-provider";

export function useColors() {
  const { colorScheme } = useThemeContext();
  return SchemeColors[colorScheme];
}
