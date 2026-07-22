import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_SANS } from "../theme";

export function SceneOutro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const ctaOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: `radial-gradient(60% 50% at 50% 40%, ${COLORS.primaryDim} 0%, ${COLORS.background} 70%)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 80,
          fontWeight: 700,
          color: COLORS.foreground,
          transform: `scale(${logoScale})`,
          letterSpacing: -1,
        }}
      >
        Halvo
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 24, color: COLORS.muted, opacity: ctaOpacity }}>
        Start selling today — halvo.io
      </div>
    </div>
  );
}
