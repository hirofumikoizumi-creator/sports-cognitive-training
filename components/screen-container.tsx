import { SafeAreaView } from "react-native-safe-area-context";
import type { Edge } from "react-native-safe-area-context";
import type { StyleProp, ViewStyle } from "react-native";
import type React from "react";

import { useColors } from "@/hooks/use-colors";

type Props = {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

export function ScreenContainer({ children, edges, style }: Props) {
  const colors = useColors();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}
