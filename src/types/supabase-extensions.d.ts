// Type augmentations for columns added by hand-written migrations
// that haven't been picked up by the auto-generated Supabase types yet.
//
// Once you regenerate `src/integrations/supabase/types.ts`, you can
// delete this file.

import type { Database } from "@/integrations/supabase/types";

type ReportRow = {
  evidence_count: number | null;
  evidence_urls: string[] | null;
};

type ReportInsert = {
  evidence_count?: number | null;
  evidence_urls?: string[] | null;
};

type ReportUpdate = {
  evidence_count?: number | null;
  evidence_urls?: string[] | null;
};

declare module "@/integrations/supabase/types" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Database {
    public: {
      Tables: {
        reports: {
          Row: Database["public"]["Tables"]["reports"]["Row"] & ReportRow;
          Insert: Database["public"]["Tables"]["reports"]["Insert"] & ReportInsert;
          Update: Database["public"]["Tables"]["reports"]["Update"] & ReportUpdate;
        };
      };
    };
  }
}
