import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { bytesByOwner, findOrphans, type StoredObject } from "@/lib/storage-sweep";

const BUCKET = "digital-assets";
type Admin = SupabaseClient<Database>;

// Every object in the bucket. Paths are at most three levels deep
// ({user}/{product|avatar|covers}/{file}), so this walks folders breadth-first.
async function listAll(admin: Admin): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  const queue: string[] = [""];
  while (queue.length) {
    const prefix = queue.shift()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
      if (error) throw new Error(`Storage list failed for "${prefix}": ${error.message}`);
      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Folders have no id; files carry their size in metadata.
        if (entry.id === null) queue.push(path);
        else out.push({ path, sizeBytes: Number(entry.metadata?.size ?? 0), createdAt: entry.created_at ?? "" });
      }
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

// Every path the app still points at.
async function referencedPaths(admin: Admin): Promise<Set<string>> {
  const refs = new Set<string>();
  const [{ data: files, error: e1 }, { data: products, error: e2 }, { data: profiles, error: e3 }] = await Promise.all([
    admin.from("product_files").select("storage_file_path"),
    admin.from("products").select("*"),
    admin.from("profiles").select("avatar_url"),
  ]);
  // Any failed read means we can't be sure what's referenced — refuse to sweep.
  if (e1 || e2 || e3) throw new Error(`Couldn't read references: ${(e1 ?? e2 ?? e3)!.message}`);
  for (const f of files ?? []) refs.add(f.storage_file_path);
  for (const p of products ?? []) {
    if (p.image_url) refs.add(p.image_url);
    for (const g of p.gallery_paths ?? []) refs.add(g);
  }
  for (const pr of profiles ?? []) if (pr.avatar_url) refs.add(pr.avatar_url);
  return refs;
}

export type SweepReport = {
  objects: number;
  storedBytes: number;
  orphans: number;
  orphanBytes: number;
  deleted: number;
  largestOwners: Array<{ owner: string; bytes: number }>;
  orphanSamples: string[];
};

// Dry run unless apply=true. Never deletes anything referenced or younger than the grace period.
export async function sweepStorage(admin: Admin, opts: { apply: boolean; now?: Date }): Promise<SweepReport> {
  const [objects, refs] = await Promise.all([listAll(admin), referencedPaths(admin)]);
  const orphans = findOrphans(objects, refs, opts.now ?? new Date());
  let deleted = 0;
  if (opts.apply) {
    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100).map((o) => o.path);
      const { error } = await admin.storage.from(BUCKET).remove(batch);
      if (error) throw new Error(`Storage delete failed: ${error.message}`);
      deleted += batch.length;
    }
  }
  const totals = [...bytesByOwner(objects).entries()].sort((a, b) => b[1] - a[1]);
  return {
    objects: objects.length,
    storedBytes: objects.reduce((s, o) => s + o.sizeBytes, 0),
    orphans: orphans.length,
    orphanBytes: orphans.reduce((s, o) => s + o.sizeBytes, 0),
    deleted,
    largestOwners: totals.slice(0, 10).map(([owner, bytes]) => ({ owner, bytes })),
    orphanSamples: orphans.slice(0, 20).map((o) => o.path),
  };
}
