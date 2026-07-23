// Pure logic for a seller's monthly download-bandwidth status, kept out of the
// server/DB glue so it's directly testable. This is deliberately a *soft* cap:
// it drives the dashboard display and upgrade nudges, and must never be used to
// block a buyer who already paid from downloading their file (doing so would
// just generate chargebacks). The real cost fix is zero-egress delivery (R2);
// this is the visibility + revenue lever in the meantime.

const BYTES_PER_GB = 1024 * 1024 * 1024;
const WARNING_THRESHOLD = 0.8;

export type BandwidthLevel = "ok" | "warning" | "over";

export type BandwidthStatus = {
  usedBytes: number;
  limitBytes: number;
  usedGb: number;
  limitGb: number;
  percent: number; // 0..100+ , rounded
  level: BandwidthLevel;
};

export function computeBandwidthStatus(usedBytes: number, limitGb: number): BandwidthStatus {
  const limitBytes = Math.round(limitGb * BYTES_PER_GB);
  const ratio = limitBytes > 0 ? usedBytes / limitBytes : 0;
  const level: BandwidthLevel = ratio >= 1 ? "over" : ratio >= WARNING_THRESHOLD ? "warning" : "ok";
  return {
    usedBytes,
    limitBytes,
    usedGb: usedBytes / BYTES_PER_GB,
    limitGb,
    percent: Math.round(ratio * 100),
    level,
  };
}
