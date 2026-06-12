import React from "react";
import { Text, TextProps, TextStyle, StyleProp } from "react-native";
import { Type, useColors } from "../../theme";

type Variant = keyof typeof Type;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Txt({
  variant = "body",
  color,
  center,
  style,
  children,
  ...rest
}: Props) {
  const colors = useColors();
  const resolved = color ?? colors.text.primary;
  return (
    <Text
      {...rest}
      style={[
        Type[variant],
        { color: resolved },
        center && { textAlign: "center" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
