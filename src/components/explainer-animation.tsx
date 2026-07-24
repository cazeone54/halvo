import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";

// A self-contained, screen-recordable 30-second explainer that plays on the
// landing page in place of a static video. Styles are prefixed `hx-` and
// injected once so they never collide with the app's Tailwind classes. The
// stage keeps its own cinematic dark-teal world regardless of the page theme.
const STYLES = `
.hx-stage{position:relative;width:100%;aspect-ratio:16/9;border-radius:18px;overflow:hidden;color:#eafcfb;
  background:radial-gradient(120% 90% at 15% 10%,#0f3b39 0%,rgba(15,59,57,0) 55%),radial-gradient(130% 100% at 90% 100%,#123f42 0%,rgba(18,63,66,0) 50%),linear-gradient(160deg,#071615 0%,#0a201f 100%);
  box-shadow:0 20px 60px rgba(0,0,0,.25);isolation:isolate;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;}
.hx-progress{position:absolute;top:0;left:0;right:0;height:4px;background:rgba(255,255,255,.1);z-index:20;}
.hx-pbar{height:100%;width:0;background:linear-gradient(90deg,#2bb6b6,#6ff2f2);animation:hx-fill 30s linear forwards;}
@keyframes hx-fill{to{width:100%;}}
.hx-scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6% 8%;opacity:0;transform:translateY(14px) scale(.99);transition:opacity .5s ease,transform .5s ease;pointer-events:none;}
.hx-scene.hx-active{opacity:1;transform:none;}
.hx-eyebrow{font-size:clamp(10px,1.4vw,13px);font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#67e6e6;margin-bottom:14px;}
.hx-big{font-size:clamp(20px,4.4vw,44px);font-weight:800;letter-spacing:-.03em;line-height:1.05;max-width:15ch;}
.hx-accent{color:#6ff2f2;}
.hx-sub{margin-top:14px;font-size:clamp(12px,1.8vw,17px);color:rgba(234,252,251,.72);max-width:34ch;}
.hx-notif{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:16px 20px;box-shadow:0 14px 40px rgba(0,0,0,.35);animation:hx-pop .55s cubic-bezier(.2,1.3,.4,1) both;}
.hx-dot{width:44px;height:44px;border-radius:12px;background:linear-gradient(150deg,#2bb6b6,#12676a);display:grid;place-items:center;font-weight:800;}
.hx-nt{text-align:left;}
.hx-nt .hx-t1{font-size:clamp(12px,1.6vw,15px);color:rgba(234,252,251,.7);}
.hx-nt .hx-t2{font-size:clamp(16px,2.4vw,22px);font-weight:800;letter-spacing:-.02em;}
.hx-amt{margin-left:10px;font-size:clamp(18px,2.8vw,26px);font-weight:800;color:#6ff2f2;font-variant-numeric:tabular-nums;}
@keyframes hx-pop{from{opacity:0;transform:translateY(24px) scale(.9);}to{opacity:1;transform:none;}}
.hx-clear{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap;justify-content:center;}
.hx-old{font-size:clamp(11px,1.6vw,14px);padding:8px 14px;border-radius:10px;background:rgba(255,120,120,.12);border:1px solid rgba(255,150,150,.25);color:#ffd9d9;text-decoration:line-through;animation:hx-out .6s ease forwards;}
.hx-old:nth-child(2){animation-delay:.25s;}.hx-old:nth-child(3){animation-delay:.5s;}
@keyframes hx-out{60%{opacity:1;transform:none;}to{opacity:0;transform:translateX(60px) rotate(4deg);}}
.hx-steps{display:flex;gap:8px;margin-bottom:26px;flex-wrap:wrap;justify-content:center;}
.hx-step{font-size:clamp(11px,1.6vw,15px);font-weight:700;padding:7px 14px;border-radius:999px;color:rgba(234,252,251,.5);border:1px solid rgba(255,255,255,.12);transition:all .3s ease;}
.hx-step.hx-on{color:#071615;background:#6ff2f2;border-color:#6ff2f2;box-shadow:0 6px 20px rgba(111,242,242,.3);}
.hx-visual{position:relative;height:clamp(84px,15vw,140px);width:min(340px,80%);}
.hx-frame{position:absolute;inset:0;display:grid;place-items:center;opacity:0;transform:scale(.96);transition:opacity .35s ease,transform .35s ease;}
.hx-frame.hx-show{opacity:1;transform:none;}
.hx-drop{width:100%;height:100%;border:2px dashed rgba(255,255,255,.3);border-radius:14px;display:grid;place-items:center;gap:6px;color:rgba(234,252,251,.75);font-weight:600;font-size:clamp(12px,1.8vw,15px);}
.hx-file{width:36px;height:44px;border-radius:6px;background:#6ff2f2;}
.hx-price{font-size:clamp(38px,8vw,68px);font-weight:800;color:#6ff2f2;letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.hx-link{font-size:clamp(12px,2vw,17px);font-weight:700;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);padding:12px 18px;border-radius:12px;display:inline-flex;align-items:center;gap:10px;}
.hx-ok{color:#6ff2f2;}
.hx-paid{display:flex;flex-direction:column;align-items:center;gap:10px;}
.hx-pay{background:#000;color:#fff;font-weight:700;padding:11px 26px;border-radius:12px;font-size:clamp(13px,2vw,17px);}
.hx-plus{font-size:clamp(18px,3.4vw,30px);font-weight:800;color:#6ff2f2;font-variant-numeric:tabular-nums;}
.hx-proof{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap;justify-content:center;}
.hx-chip{font-size:clamp(11px,1.6vw,14px);font-weight:700;padding:8px 16px;border-radius:999px;background:rgba(111,242,242,.12);border:1px solid rgba(111,242,242,.3);color:#b9fbfb;opacity:0;transform:translateY(10px);animation:hx-rise .5s ease forwards;}
.hx-chip:nth-child(2){animation-delay:.15s;}.hx-chip:nth-child(3){animation-delay:.3s;}
@keyframes hx-rise{to{opacity:1;transform:none;}}
.hx-lock{display:flex;align-items:center;gap:16px;animation:hx-pop .6s cubic-bezier(.2,1.3,.4,1) both;}
.hx-word{font-size:clamp(28px,6vw,52px);font-weight:800;letter-spacing:-.04em;}
.hx-url{margin-top:18px;font-size:clamp(13px,2vw,18px);color:rgba(234,252,251,.8);}
.hx-btn{margin-top:16px;background:#6ff2f2;color:#071615;font-weight:800;padding:12px 28px;border-radius:12px;font-size:clamp(13px,2vw,17px);}
@media (prefers-reduced-motion:reduce){
  .hx-scene{transition:opacity .2s linear;}
  .hx-notif,.hx-lock,.hx-old,.hx-chip,.hx-pbar{animation:none;opacity:1;transform:none;}
  .hx-pbar{width:100%;}
}
`;

const STEPS = ["Upload", "Price", "Share", "Paid"];

export function ExplainerAnimation() {
  const [scene, setScene] = useState("hook");
  const [step, setStep] = useState(-1);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    setScene("hook");
    setStep(-1);
    at(3000, () => setScene("tension"));
    at(7000, () => { setScene("motion"); setStep(0); });
    at(10000, () => setStep(1));
    at(13000, () => setStep(2));
    at(16000, () => setStep(3));
    at(20000, () => setScene("proof"));
    at(26000, () => setScene("cta"));
    return () => timers.forEach(clearTimeout);
  }, [runId]);

  const on = (name: string) => `hx-scene${scene === name ? " hx-active" : ""}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <style>{STYLES}</style>
      <div className="hx-stage">
        <div className="hx-progress">
          {/* key restarts the CSS fill animation on replay */}
          <div className="hx-pbar" key={runId} />
        </div>

        <section className={on("hook")}>
          <div className="hx-notif">
            <div className="hx-dot">H</div>
            <div className="hx-nt">
              <div className="hx-t1">Halvo</div>
              <div className="hx-t2">You made a sale</div>
            </div>
            <div className="hx-amt">+$39.00</div>
          </div>
          <div className="hx-sub">This took a weekend to make. It just made money while you slept.</div>
        </section>

        <section className={on("tension")}>
          <div className="hx-big">
            The old way, <span className="hx-accent">gone.</span>
          </div>
          <div className="hx-clear">
            <span className="hx-old">Build a whole store</span>
            <span className="hx-old">Lose 10% to a marketplace</span>
            <span className="hx-old">Wait a week for payout</span>
          </div>
        </section>

        <section className={on("motion")}>
          <div className="hx-eyebrow">The whole store, in four steps</div>
          <div className="hx-steps">
            {STEPS.map((label, i) => (
              <span key={label} className={`hx-step${step === i ? " hx-on" : ""}`}>
                {label}
              </span>
            ))}
          </div>
          <div className="hx-visual">
            <div className={`hx-frame${step === 0 ? " hx-show" : ""}`}>
              <div className="hx-drop"><div className="hx-file" />Drop your file</div>
            </div>
            <div className={`hx-frame${step === 1 ? " hx-show" : ""}`}>
              <div className="hx-price">$39</div>
            </div>
            <div className={`hx-frame${step === 2 ? " hx-show" : ""}`}>
              <div className="hx-link">
                halvo.io/p/starter-kit <span className="hx-ok">✓ copied</span>
              </div>
            </div>
            <div className={`hx-frame${step === 3 ? " hx-show" : ""}`}>
              <div className="hx-paid">
                <div className="hx-pay">Pay</div>
                <div className="hx-plus">+$37.00 → your Stripe</div>
              </div>
            </div>
          </div>
        </section>

        <section className={on("proof")}>
          <div className="hx-big">
            The money lands in <span className="hx-accent">your</span> Stripe. Instantly.
          </div>
          <div className="hx-proof">
            <span className="hx-chip">Discount codes</span>
            <span className="hx-chip">Affiliate links</span>
            <span className="hx-chip">Keep more of every sale</span>
          </div>
        </section>

        <section className={on("cta")}>
          <div className="hx-lock">
            <LogoMark className="h-16 w-16" />
            <span className="hx-word">Halvo</span>
          </div>
          <div className="hx-url">Your first product can be live in five minutes.</div>
          <div className="hx-btn">Start free · halvo.io</div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setRunId((n) => n + 1)}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        ↻ Replay
      </button>
    </div>
  );
}
