import { Composition } from "remotion";
import { Explainer, TOTAL_DURATION } from "./Explainer";

export function RemotionRoot() {
  return (
    <Composition
      id="Explainer"
      component={Explainer}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={1280}
      height={720}
    />
  );
}
