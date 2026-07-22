import { AbsoluteFill, Sequence } from "remotion";
import { COLORS } from "./theme";
import { SceneIntro } from "./scenes/SceneIntro";
import { SceneListProduct } from "./scenes/SceneListProduct";
import { SceneCheckout } from "./scenes/SceneCheckout";
import { ScenePayout } from "./scenes/ScenePayout";
import { SceneOutro } from "./scenes/SceneOutro";

const INTRO = 150;
const LIST_PRODUCT = 210;
const CHECKOUT = 210;
const PAYOUT = 210;
const OUTRO = 120;

export function Explainer() {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <Sequence from={0} durationInFrames={INTRO}>
        <SceneIntro />
      </Sequence>
      <Sequence from={INTRO} durationInFrames={LIST_PRODUCT}>
        <SceneListProduct />
      </Sequence>
      <Sequence from={INTRO + LIST_PRODUCT} durationInFrames={CHECKOUT}>
        <SceneCheckout />
      </Sequence>
      <Sequence from={INTRO + LIST_PRODUCT + CHECKOUT} durationInFrames={PAYOUT}>
        <ScenePayout />
      </Sequence>
      <Sequence from={INTRO + LIST_PRODUCT + CHECKOUT + PAYOUT} durationInFrames={OUTRO}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
}

export const TOTAL_DURATION = INTRO + LIST_PRODUCT + CHECKOUT + PAYOUT + OUTRO;
