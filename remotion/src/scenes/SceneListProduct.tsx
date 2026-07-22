import { useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";
import { SceneLayout, MockCard, FieldRow } from "./SceneLayout";

export function SceneListProduct() {
  const frame = useCurrentFrame();
  const buttonScale = interpolate(frame, [110, 125], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneLayout heading="List your product in seconds">
      <MockCard>
        <FieldRow label="Name" value="Freelance Invoice Tracker" delay={20} />
        <FieldRow label="Description" value="A Notion template to track client invoices" delay={45} />
        <FieldRow label="Price (USD)" value="$19.00" delay={70} />
        <div
          style={{
            marginTop: 8,
            borderRadius: 10,
            background: COLORS.primary,
            color: "#04211f",
            fontWeight: 700,
            textAlign: "center",
            padding: "14px 0",
            fontSize: 18,
            opacity: interpolate(frame, [95, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `scale(${buttonScale})`,
          }}
        >
          Create product
        </div>
      </MockCard>
    </SceneLayout>
  );
}
