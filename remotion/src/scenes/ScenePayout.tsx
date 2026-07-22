import { useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_SANS } from "../theme";
import { SceneLayout } from "./SceneLayout";

export function ScenePayout() {
  const frame = useCurrentFrame();
  const arrowProgress = interpolate(frame, [20, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const walletScale = interpolate(frame, [65, 85], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const walletOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneLayout heading="Get paid directly via Stripe">
      <div style={{ display: "flex", alignItems: "center", gap: 32, fontFamily: FONT_SANS }}>
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.card,
            padding: "20px 28px",
            color: COLORS.foreground,
            fontSize: 18,
            textAlign: "center",
          }}
        >
          Sale
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>$19.00</div>
        </div>

        <div style={{ width: 160, height: 4, background: COLORS.border, borderRadius: 999, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${arrowProgress * 100}%`,
              background: COLORS.primary,
              borderRadius: 999,
            }}
          />
        </div>

        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${COLORS.primary}`,
            background: COLORS.primaryDim,
            padding: "20px 28px",
            color: COLORS.foreground,
            fontSize: 18,
            textAlign: "center",
            opacity: walletOpacity,
            transform: `scale(${walletScale})`,
          }}
        >
          Your Stripe balance
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: COLORS.primary }}>+$19.00</div>
        </div>
      </div>
    </SceneLayout>
  );
}
