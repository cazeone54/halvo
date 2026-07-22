import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT_SANS } from "../theme";
import { SceneLayout, MockCard } from "./SceneLayout";

export function SceneCheckout() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const walletOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const checkScale = spring({ frame: frame - 100, fps, config: { damping: 10, mass: 0.5 } });
  const checkOpacity = interpolate(frame, [100, 112], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <SceneLayout heading="Buyers check out instantly">
      <MockCard>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_SANS }}>
          <span style={{ color: COLORS.foreground, fontSize: 18 }}>Freelance Invoice Tracker</span>
          <span style={{ color: COLORS.foreground, fontSize: 18, fontWeight: 700 }}>$19.00</span>
        </div>
        <div
          style={{
            opacity: walletOpacity,
            display: "flex",
            gap: 12,
          }}
        >
          {["Apple Pay", "Google Pay", "Card"].map((label) => (
            <div
              key={label}
              style={{
                flex: 1,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,0.03)",
                color: COLORS.muted,
                fontSize: 14,
                textAlign: "center",
                padding: "10px 0",
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            opacity: checkOpacity,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: COLORS.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${checkScale})`,
              fontSize: 28,
              color: "#04211f",
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <span style={{ color: COLORS.muted, fontSize: 14 }}>Payment succeeded — download unlocked</span>
        </div>
      </MockCard>
    </SceneLayout>
  );
}
