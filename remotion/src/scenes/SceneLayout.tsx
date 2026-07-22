import { useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT_DISPLAY, FONT_SANS } from "../theme";

export function SceneLayout({ heading, children }: { heading: string; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const headingOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headingY = interpolate(frame, [0, 15], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        background: COLORS.background,
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 44,
          fontWeight: 700,
          color: COLORS.foreground,
          opacity: headingOpacity,
          transform: `translateY(${headingY}px)`,
        }}
      >
        {heading}
      </div>
      {children}
    </div>
  );
}

export function MockCard({ children, width = 520 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      style={{
        width,
        borderRadius: 20,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: FONT_SANS,
      }}
    >
      {children}
    </div>
  );
}

export function FieldRow({ label, value, delay }: { label: string; value: string; delay: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(frame, [delay, delay + 12], [-16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ opacity, transform: `translateX(${x}px)` }}>
      <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          background: "rgba(255,255,255,0.03)",
          padding: "12px 16px",
          fontSize: 18,
          color: COLORS.foreground,
        }}
      >
        {value}
      </div>
    </div>
  );
}
