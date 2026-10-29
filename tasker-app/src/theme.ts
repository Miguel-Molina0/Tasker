// Tasker's supplied logo: violet star, indigo/blue edge and a pale lilac check.
export const brand = {
  ink: "#120B18",
  purple: "#8E14BC",
  violet: "#5E2EAA",
  blue: "#1B5090",
  lilac: "#C681D9",
  pale: "#F4E6FC",
  white: "#FFFCFF",
  gradient: ["#8E14BC", "#5E2EAA", "#1B5090"] as const,
  heroGradient: ["#211029", "#49205D", "#1B315B"] as const,
};

export type ThemeColors = {
  bg: string;
  card: string;
  panel: string;
  text: string;
  muted: string;
  line: string;
  controlLine: string;
  primary: string;
  primaryEnd: string;
  accent: string;
  blue: string;
  tint: string;
  onPrimary: string;
  danger: string;
  dangerFill: string;
  success: string;
  gradient: readonly [string, string, string];
};

export const dark: ThemeColors = {
  bg: "#100A14",
  card: "#190F20",
  panel: "#24142E",
  text: brand.white,
  muted: "#BDAAC8",
  line: "#3E284B",
  controlLine: "#81678D",
  primary: "#7B22AF",
  primaryEnd: brand.blue,
  accent: "#CF98E1",
  blue: "#8CAFE6",
  tint: "#30203E",
  onPrimary: brand.white,
  danger: "#FB8AA5",
  dangerFill: "#AD2048",
  success: "#80DFBA",
  gradient: brand.gradient,
};

export const light: ThemeColors = {
  ...dark,
  bg: "#FCF8FF",
  card: "#FFFFFF",
  panel: "#F1E7F8",
  text: "#25132E",
  muted: "#735F7E",
  line: "#DDCBE8",
  controlLine: "#93759E",
  accent: "#763795",
  blue: "#245CA4",
  tint: "#E6D6F1",
  danger: "#B82048",
  success: "#087651",
};
