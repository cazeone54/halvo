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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_files: {
        Row: {
          id: string;
          product_id: string;
          owner_id: string;
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
          stripe_payment_intent_id: string | null;
          refunded_at: string | null;
          coupon_code: string | null;
          terms_acked_at: string | null;
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
          stripe_payment_intent_id?: string | null;
          refunded_at?: string | null;
          coupon_code?: string | null;
          terms_acked_at?: string | null;
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
          stripe_payment_intent_id?: string | null;
          refunded_at?: string | null;
          coupon_code?: string | null;
          terms_acked_at?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          product_file_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          product_file_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
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
