import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_SANS } from "../theme";

export function SceneIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const taglineOpacity = interpolate(frame, [40, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const taglineY = interpolate(frame, [40, 65], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: `radial-gradient(60% 50% at 50% 40%, ${COLORS.primaryDim} 0%, ${COLORS.background} 70%)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 120,
          fontWeight: 700,
          color: COLORS.foreground,
          transform: `scale(${titleScale})`,
          letterSpacing: -2,
        }}
      >
        Halvo
      </div>
      <div
        style={{
          fontFamily: FONT_SANS,
          fontSize: 32,
          color: COLORS.muted,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        Sell digital products in minutes
      </div>
    </div>
  );
}
