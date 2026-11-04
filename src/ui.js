import React, { createContext, useContext } from "react";
import { Text, View, Pressable, useColorScheme } from "react-native";
export const Theme = createContext({});
export const usePalette = () =>
  useColorScheme() === "dark"
    ? {
        bg: "#101b23",
        card: "#1a2933",
        ink: "#f1f6f7",
        muted: "#afc3c8",
        line: "#40535f",
        accent: "#75dfca",
        warn: "#ffc59c",
      }
    : {
        bg: "#f2f6f5",
        card: "#ffffff",
        ink: "#132c32",
        muted: "#455f65",
        line: "#c6d6d5",
        accent: "#006958",
        warn: "#993f19",
      };
export function T({ children, kind, alert = false }) {
  const c = useContext(Theme);
  const heading = kind === "title" || kind === "heading";
  return (
    <Text
      accessibilityRole={heading ? "header" : undefined}
      accessibilityLiveRegion={alert ? "polite" : undefined}
      style={{
        color: alert
          ? c.warn
          : kind === "muted"
            ? c.muted
            : kind === "eyebrow"
              ? c.accent
              : c.ink,
        fontSize:
          kind === "title"
            ? 32
            : kind === "heading"
              ? 21
              : kind === "eyebrow"
                ? 13
                : 16,
        fontWeight: heading ? "700" : kind === "eyebrow" ? "600" : "400",
        letterSpacing: kind === "eyebrow" ? 1 : 0,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({ children }) {
  const c = useContext(Theme);
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderColor: c.line,
        borderWidth: 1,
        borderRadius: 18,
        padding: 18,
        gap: 9,
      }}
    >
      {children}
    </View>
  );
}
export function Action({ children, onPress, disabled = false }) {
  const c = useContext(Theme);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 46,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: pressed ? c.line : c.card,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text style={{ color: c.accent, fontWeight: "600", fontSize: 16 }}>
        {children}
      </Text>
    </Pressable>
  );
}
