// Hand-written to match supabase/migrations/0001_init.sql.
// Once the Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
// and re-apply any manual additions.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string | null;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          stripe_connect_id: string | null;
          support_email: string | null;
          refund_policy: string | null;
          thank_you_message: string | null;
          thank_you_redirect_url: string | null;
          accent_color: string | null;
          deactivated_at: string | null;
          // Present once migration 0024 is applied.
          stripe_charges_enabled: boolean;
          // Link-in-bio (migration 0028). Read through link-in-bio.ts's
          // *ForDisplay helpers, which validate whatever is stored.
          social_links: Json;
          bio_links: Json;
          featured_product_ids: string[];
          // Shop funnel (migration 0029).
          start_here_product_id: string | null;
          offer_product_id: string | null;
          offer_coupon_code: string | null;
          // Shop look (migration 0030).
          banner_path: string | null;
          announcement_text: string | null;
          announcement_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          stripe_connect_id?: string | null;
          support_email?: string | null;
          refund_policy?: string | null;
          thank_you_message?: string | null;
          thank_you_redirect_url?: string | null;
          accent_color?: string | null;
          deactivated_at?: string | null;
          stripe_charges_enabled?: boolean;
          social_links?: Json;
          bio_links?: Json;
          featured_product_ids?: string[];
          start_here_product_id?: string | null;
          offer_product_id?: string | null;
          offer_coupon_code?: string | null;
          banner_path?: string | null;
          announcement_text?: string | null;
          announcement_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          stripe_connect_id?: string | null;
          support_email?: string | null;
          refund_policy?: string | null;
          thank_you_message?: string | null;
          thank_you_redirect_url?: string | null;
          accent_color?: string | null;
          deactivated_at?: string | null;
          stripe_charges_enabled?: boolean;
          social_links?: Json;
          bio_links?: Json;
          featured_product_ids?: string[];
          start_here_product_id?: string | null;
          offer_product_id?: string | null;
          offer_coupon_code?: string | null;
          banner_path?: string | null;
          announcement_text?: string | null;
          announcement_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Follow-up emails after a free download (migration 0029).
      email_sequences: {
        Row: {
          seller_id: string;
          enabled: boolean;
          enabled_at: string | null;
          step2_subject: string;
          step2_body: string;
          step3_subject: string;
          step3_body: string;
          step3_product_id: string | null;
          step3_coupon_code: string | null;
          updated_at: string;
        };
        Insert: {
          seller_id: string;
          enabled?: boolean;
          enabled_at?: string | null;
          step2_subject?: string;
          step2_body?: string;
          step3_subject?: string;
          step3_body?: string;
          step3_product_id?: string | null;
          step3_coupon_code?: string | null;
          updated_at?: string;
        };
        Update: {
          seller_id?: string;
          enabled?: boolean;
          enabled_at?: string | null;
          step2_subject?: string;
          step2_body?: string;
          step3_subject?: string;
          step3_body?: string;
          step3_product_id?: string | null;
          step3_coupon_code?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Which follow-up went to which free download; unique (transaction_id, step).
      sequence_sends: {
        Row: { id: number; seller_id: string; transaction_id: string; step: number; sent_at: string };
        Insert: { id?: number; seller_id: string; transaction_id: string; step: number; sent_at?: string };
        Update: { id?: number; seller_id?: string; transaction_id?: string; step?: number; sent_at?: string };
        Relationships: [];
      };
      // One row per visit to a seller's page (migration 0029). Server-written.
      shop_views: {
        Row: { id: number; seller_id: string; source: string | null; created_at: string };
        Insert: { id?: number; seller_id: string; source?: string | null; created_at?: string };
        Update: { id?: number; seller_id?: string; source?: string | null; created_at?: string };
        Relationships: [];
      };
      // One row per click on a seller's link-in-bio link (migration 0028).
      // Written only by the service role from /go/; sellers read their own.
      link_clicks: {
        Row: {
          id: number;
          profile_id: string;
          link_id: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          profile_id: string;
          link_id: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          profile_id?: string;
          link_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "link_clicks_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          owner_id: string | null;
          name: string;
          description: string | null;
          price_cents: number;
          pay_what_you_want: boolean;
          image_url: string | null;
          url_slug: string | null;
          category: string | null;
          refund_policy: string | null;
          license_key_enabled: boolean;
          preview_video_url: string | null;
          gallery_paths: string[];
          stock_limit: number | null;
          sale_price_cents: number | null;
          // Seller's own dollar price (migration 0026); null = same number as euros.
          price_usd_cents: number | null;
          sale_ends_at: string | null;
          billing_type: string;
          billing_interval: string | null;
          installment_count: number | null;
          stripe_product_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          name: string;
          description?: string | null;
          price_cents: number;
          pay_what_you_want?: boolean;
          image_url?: string | null;
          url_slug?: string | null;
          category?: string | null;
          refund_policy?: string | null;
          license_key_enabled?: boolean;
          preview_video_url?: string | null;
          gallery_paths?: string[];
          stock_limit?: number | null;
          sale_price_cents?: number | null;
          price_usd_cents?: number | null;
          sale_ends_at?: string | null;
          billing_type?: string;
          billing_interval?: string | null;
          installment_count?: number | null;
          stripe_product_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          name?: string;
          description?: string | null;
          price_cents?: number;
          pay_what_you_want?: boolean;
          image_url?: string | null;
          url_slug?: string | null;
          category?: string | null;
          refund_policy?: string | null;
          license_key_enabled?: boolean;
          preview_video_url?: string | null;
          gallery_paths?: string[];
          stock_limit?: number | null;
          sale_price_cents?: number | null;
          price_usd_cents?: number | null;
          sale_ends_at?: string | null;
          billing_type?: string;
          billing_interval?: string | null;
          installment_count?: number | null;
          stripe_product_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      buyer_subscriptions: {
        Row: {
          id: string;
          product_id: string | null;
          seller_id: string | null;
          buyer_email: string;
          buyer_id: string | null;
          kind: string;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          status: string;
          amount_cents: number;
          currency: string;
          billing_interval: string;
          installments_total: number | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          past_due_since: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          seller_id?: string | null;
          buyer_email: string;
          buyer_id?: string | null;
          kind: string;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          status: string;
          amount_cents: number;
          currency?: string;
          billing_interval?: string;
          installments_total?: number | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          past_due_since?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          seller_id?: string | null;
          buyer_email?: string;
          buyer_id?: string | null;
          kind?: string;
          stripe_subscription_id?: string;
          stripe_customer_id?: string;
          status?: string;
          amount_cents?: number;
          currency?: string;
          billing_interval?: string;
          installments_total?: number | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          past_due_since?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      broadcasts: {
        Row: {
          id: string;
          seller_id: string;
          product_id: string | null;
          subject: string;
          body: string;
          recipient_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          product_id?: string | null;
          subject: string;
          body: string;
          recipient_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          product_id?: string | null;
          subject?: string;
          body?: string;
          recipient_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      broadcast_unsubscribes: {
        Row: {
          seller_id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          seller_id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          seller_id?: string;
          email?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      license_keys: {
        Row: {
          id: string;
          transaction_id: string;
          product_id: string | null;
          license_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          product_id?: string | null;
          license_key: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          product_id?: string | null;
          license_key?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "license_keys_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: true;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      product_files: {
        Row: {
          // Null once the owning account is deleted — the row is kept so the
          // buyer's download survives (migration 0022).
          id: string;
          product_id: string;
          owner_id: string | null;
          storage_file_path: string;
          file_name: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          owner_id: string;
          storage_file_path: string;
          file_name?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          owner_id?: string;
          storage_file_path?: string;
          file_name?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          product_id: string;
          seller_id: string | null;
          buyer_id: string | null;
          buyer_email: string;
          status: string;
          amount_paid_cents: number;
          currency: string;
          stripe_payment_intent_id: string | null;
          buyer_subscription_id: string | null;
          is_renewal: boolean;
          refunded_at: string | null;
          coupon_code: string | null;
          terms_acked_at: string | null;
          disputed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          seller_id?: string | null;
          buyer_id?: string | null;
          buyer_email: string;
          status?: string;
          amount_paid_cents: number;
          currency?: string;
          stripe_payment_intent_id?: string | null;
          buyer_subscription_id?: string | null;
          is_renewal?: boolean;
          refunded_at?: string | null;
          coupon_code?: string | null;
          terms_acked_at?: string | null;
          disputed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          seller_id?: string | null;
          buyer_id?: string | null;
          buyer_email?: string;
          status?: string;
          amount_paid_cents?: number;
          currency?: string;
          stripe_payment_intent_id?: string | null;
          buyer_subscription_id?: string | null;
          is_renewal?: boolean;
          refunded_at?: string | null;
          coupon_code?: string | null;
          terms_acked_at?: string | null;
          disputed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      download_events: {
        Row: {
          id: string;
          transaction_id: string;
          product_file_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          bytes: number;
          seller_id: string | null;
          // Free delivery, subject to the monthly cap (migration 0027).
          is_free: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          product_file_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          bytes?: number;
          seller_id?: string | null;
          is_free?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          product_file_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          bytes?: number;
          seller_id?: string | null;
          is_free?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "download_events_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      product_bumps: {
        Row: {
          id: string;
          product_id: string;
          bump_product_id: string;
          price_cents: number;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          bump_product_id: string;
          price_cents: number;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          bump_product_id?: string;
          price_cents?: number;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transaction_bumps: {
        Row: {
          id: string;
          transaction_id: string;
          bump_product_id: string;
          price_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          bump_product_id: string;
          price_cents: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          bump_product_id?: string;
          price_cents?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      bundle_items: {
        Row: {
          // Null once the owning account is deleted — the row is kept so a
          // bundle a buyer already paid for still expands (migration 0022).
          id: string;
          bundle_product_id: string;
          item_product_id: string;
          owner_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bundle_product_id: string;
          item_product_id: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          bundle_product_id?: string;
          item_product_id?: string;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_product_id_fkey";
            columns: ["bundle_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          product_id: string;
          transaction_id: string;
          buyer_email: string;
          rating: number;
          body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          transaction_id: string;
          buyer_email: string;
          rating: number;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          transaction_id?: string;
          buyer_email?: string;
          rating?: number;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_sources: {
        Row: {
          id: string;
          transaction_id: string;
          seller_id: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          seller_id?: string | null;
          source: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          seller_id?: string | null;
          source?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sale_sources_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: true;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      product_views: {
        Row: {
          id: string;
          product_id: string;
          // Normalised channel (migration 0023). Null for views recorded
          // before it, reported as "Unknown".
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          source?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      // Where each new account came from (migration 0025). Server-only: RLS
      // on with no policies, so only the service role reads or writes it.
      signup_sources: {
        Row: {
          user_id: string;
          source: string;
          campaign: string | null;
          content: string | null;
          landing_path: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          source: string;
          campaign?: string | null;
          content?: string | null;
          landing_path?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          source?: string;
          campaign?: string | null;
          content?: string | null;
          landing_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      disputes: {
        Row: {
          id: string;
          transaction_id: string | null;
          stripe_dispute_id: string;
          amount_cents: number;
          reason: string | null;
          status: string;
          transfer_reversed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id?: string | null;
          stripe_dispute_id: string;
          amount_cents?: number;
          reason?: string | null;
          status: string;
          transfer_reversed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string | null;
          stripe_dispute_id?: string;
          amount_cents?: number;
          reason?: string | null;
          status?: string;
          transfer_reversed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          price_id: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          price_id: string;
          status: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string;
          stripe_customer_id?: string;
          price_id?: string;
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          owner_id: string;
          product_id: string | null;
          code: string;
          percent_off: number | null;
          amount_off_cents: number | null;
          max_redemptions: number | null;
          active: boolean;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          product_id?: string | null;
          code: string;
          percent_off?: number | null;
          amount_off_cents?: number | null;
          max_redemptions?: number | null;
          active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          product_id?: string | null;
          code?: string;
          percent_off?: number | null;
          amount_off_cents?: number | null;
          max_redemptions?: number | null;
          active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupon_redemptions: {
        Row: {
          id: string;
          coupon_id: string;
          transaction_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          coupon_id: string;
          transaction_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          coupon_id?: string;
          transaction_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      referral_codes: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          kind: "platform" | "product";
          product_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          kind: "platform" | "product";
          product_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          kind?: "platform" | "product";
          product_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      commissions: {
        Row: {
          id: string;
          referral_code_id: string;
          referrer_user_id: string;
          transaction_id: string;
          kind: "platform" | "product";
          amount_cents: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          referral_code_id: string;
          referrer_user_id: string;
          transaction_id: string;
          kind: "platform" | "product";
          amount_cents: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          referral_code_id?: string;
          referrer_user_id?: string;
          transaction_id?: string;
          kind?: "platform" | "product";
          amount_cents?: number;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_generations: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- required shape for supabase-js's generic inference
    Views: {};
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- required shape for supabase-js's generic inference
    Functions: {};
    Enums: {
      referral_kind: "platform" | "product";
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- required shape for supabase-js's generic inference
    CompositeTypes: {};
  };
};
