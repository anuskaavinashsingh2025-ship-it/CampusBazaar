export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["admin_action_type"];
          admin_user_id: string;
          created_at: string;
          id: string;
          notes: string | null;
          product_id: string | null;
          target_user_id: string | null;
        };
        Insert: {
          action_type: Database["public"]["Enums"]["admin_action_type"];
          admin_user_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          product_id?: string | null;
          target_user_id?: string | null;
        };
        Update: {
          action_type?: Database["public"]["Enums"]["admin_action_type"];
          admin_user_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          product_id?: string | null;
          target_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_actions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_admin_access_logs: {
        Row: {
          admin_id: string;
          conversation_id: string;
          created_at: string;
          id: string;
          reason: string;
        };
        Insert: {
          admin_id: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          reason: string;
        };
        Update: {
          admin_id?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_admin_access_logs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_reports: {
        Row: {
          conversation_id: string;
          created_at: string;
          details: string | null;
          id: string;
          reason: Database["public"]["Enums"]["chat_report_reason"];
          report_target: Database["public"]["Enums"]["chat_report_target"];
          reported_user_id: string | null;
          reporter_id: string;
          status: Database["public"]["Enums"]["report_status"];
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database["public"]["Enums"]["chat_report_reason"];
          report_target: Database["public"]["Enums"]["chat_report_target"];
          reported_user_id?: string | null;
          reporter_id: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["chat_report_reason"];
          report_target?: Database["public"]["Enums"]["chat_report_target"];
          reported_user_id?: string | null;
          reporter_id?: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "chat_reports_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_ratings: {
        Row: {
          conversation_id: string;
          created_at: string;
          id: string;
          rater_id: string;
          rating: number;
          review: string | null;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          id?: string;
          rater_id: string;
          rating: number;
          review?: string | null;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          id?: string;
          rater_id?: string;
          rating?: number;
          review?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_ratings_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          archived_at: string | null;
          buyer_id: string;
          buyer_unread_count: number;
          completed_at: string | null;
          context_id: string;
          context_type: Database["public"]["Enums"]["chat_context_type"];
          created_at: string;
          id: string;
          is_reported: boolean;
          last_message_at: string | null;
          last_message_preview: string | null;
          last_message_sender_id: string | null;
          listing_title: string;
          request_id: string | null;
          seller_id: string;
          seller_unread_count: number;
          status: Database["public"]["Enums"]["conversation_status"];
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          buyer_id: string;
          buyer_unread_count?: number;
          completed_at?: string | null;
          context_id: string;
          context_type: Database["public"]["Enums"]["chat_context_type"];
          created_at?: string;
          id?: string;
          is_reported?: boolean;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_message_sender_id?: string | null;
          listing_title: string;
          request_id?: string | null;
          seller_id: string;
          seller_unread_count?: number;
          status?: Database["public"]["Enums"]["conversation_status"];
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          buyer_id?: string;
          buyer_unread_count?: number;
          completed_at?: string | null;
          context_id?: string;
          context_type?: Database["public"]["Enums"]["chat_context_type"];
          created_at?: string;
          id?: string;
          is_reported?: boolean;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_message_sender_id?: string | null;
          listing_title?: string;
          request_id?: string | null;
          seller_id?: string;
          seller_unread_count?: number;
          status?: Database["public"]["Enums"]["conversation_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          admin_notes: string | null;
          category: string;
          created_at: string | null;
          id: string;
          message: string;
          rating: number;
          screenshot_url: string | null;
          status: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          admin_notes?: string | null;
          category: string;
          created_at?: string | null;
          id?: string;
          message: string;
          rating: number;
          screenshot_url?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          admin_notes?: string | null;
          category?: string;
          created_at?: string | null;
          id?: string;
          message?: string;
          rating?: number;
          screenshot_url?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      food_images: {
        Row: {
          created_at: string;
          food_listing_id: string;
          id: string;
          sort_index: number;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          food_listing_id: string;
          id?: string;
          sort_index: number;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          food_listing_id?: string;
          id?: string;
          sort_index?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_images_food_listing_id_fkey";
            columns: ["food_listing_id"];
            isOneToOne: false;
            referencedRelation: "food_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      food_listings: {
        Row: {
          brand_name: string;
          category: string;
          created_at: string;
          description: string;
          expiry_date: string;
          id: string;
          price: number;
          product_name: string;
          quantity: string;
          seller_id: string;
          status: Database["public"]["Enums"]["food_listing_status"];
          updated_at: string;
          views_count: number;
          wishlist_count: number;
        };
        Insert: {
          brand_name: string;
          category: string;
          created_at?: string;
          description: string;
          expiry_date: string;
          id?: string;
          price: number;
          product_name: string;
          quantity: string;
          seller_id: string;
          status?: Database["public"]["Enums"]["food_listing_status"];
          updated_at?: string;
          views_count?: number;
          wishlist_count?: number;
        };
        Update: {
          brand_name?: string;
          category?: string;
          created_at?: string;
          description?: string;
          expiry_date?: string;
          id?: string;
          price?: number;
          product_name?: string;
          quantity?: string;
          seller_id?: string;
          status?: Database["public"]["Enums"]["food_listing_status"];
          updated_at?: string;
          views_count?: number;
          wishlist_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "food_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      food_orders: {
        Row: {
          buyer_id: string;
          created_at: string;
          food_listing_id: string;
          id: string;
          message: string | null;
          quantity: number;
          seller_id: string;
          status: Database["public"]["Enums"]["food_order_status"];
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          food_listing_id: string;
          id?: string;
          message?: string | null;
          quantity?: number;
          seller_id: string;
          status?: Database["public"]["Enums"]["food_order_status"];
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          food_listing_id?: string;
          id?: string;
          message?: string | null;
          quantity?: number;
          seller_id?: string;
          status?: Database["public"]["Enums"]["food_order_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_orders_food_listing_id_fkey";
            columns: ["food_listing_id"];
            isOneToOne: false;
            referencedRelation: "food_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      food_requests: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          expires_at: string | null;
          id: string;
          product_name: string;
          quantity_needed: string;
          requester_id: string;
          status: Database["public"]["Enums"]["food_request_status"];
          updated_at: string;
          urgency_level: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description: string;
          expires_at?: string | null;
          id?: string;
          product_name: string;
          quantity_needed: string;
          requester_id: string;
          status?: Database["public"]["Enums"]["food_request_status"];
          updated_at?: string;
          urgency_level?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          expires_at?: string | null;
          id?: string;
          product_name?: string;
          quantity_needed?: string;
          requester_id?: string;
          status?: Database["public"]["Enums"]["food_request_status"];
          updated_at?: string;
          urgency_level?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          delivery_status: Database["public"]["Enums"]["message_delivery_status"];
          id: string;
          message_type: Database["public"]["Enums"]["message_type"];
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          delivery_status?: Database["public"]["Enums"]["message_delivery_status"];
          id?: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          delivery_status?: Database["public"]["Enums"]["message_delivery_status"];
          id?: string;
          message_type?: Database["public"]["Enums"]["message_type"];
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      notes_assets: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          listing_id: string;
          sort_index: number;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          listing_id: string;
          sort_index?: number;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          listing_id?: string;
          sort_index?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_assets_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "notes_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      notes_listings: {
        Row: {
          branch: string | null;
          category: string;
          condition: string | null;
          created_at: string;
          daily_rental_price: number | null;
          description: string;
          faculty: string | null;
          id: string;
          is_digital: boolean;
          is_free: boolean;
          listing_type: Database["public"]["Enums"]["notes_listing_type"];
          rental_duration_days: number | null;
          seller_id: string;
          semester: string | null;
          status: Database["public"]["Enums"]["notes_status"];
          subject: string | null;
          title: string;
          updated_at: string;
          views_count: number;
          wishlist_count: number;
        };
        Insert: {
          branch?: string | null;
          category: string;
          condition?: string | null;
          created_at?: string;
          daily_rental_price?: number | null;
          description: string;
          faculty?: string | null;
          id?: string;
          is_digital?: boolean;
          is_free?: boolean;
          listing_type: Database["public"]["Enums"]["notes_listing_type"];
          rental_duration_days?: number | null;
          seller_id: string;
          semester?: string | null;
          status?: Database["public"]["Enums"]["notes_status"];
          subject?: string | null;
          title: string;
          updated_at?: string;
          views_count?: number;
          wishlist_count?: number;
        };
        Update: {
          branch?: string | null;
          category?: string;
          condition?: string | null;
          created_at?: string;
          daily_rental_price?: number | null;
          description?: string;
          faculty?: string | null;
          id?: string;
          is_digital?: boolean;
          is_free?: boolean;
          listing_type?: Database["public"]["Enums"]["notes_listing_type"];
          rental_duration_days?: number | null;
          seller_id?: string;
          semester?: string | null;
          status?: Database["public"]["Enums"]["notes_status"];
          subject?: string | null;
          title?: string;
          updated_at?: string;
          views_count?: number;
          wishlist_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "notes_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      notes_purchase_requests: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          message: string | null;
          notes_listing_id: string;
          seller_id: string;
          status: Database["public"]["Enums"]["notes_purchase_status"];
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          notes_listing_id: string;
          seller_id: string;
          status?: Database["public"]["Enums"]["notes_purchase_status"];
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          notes_listing_id?: string;
          seller_id?: string;
          status?: Database["public"]["Enums"]["notes_purchase_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_purchase_requests_notes_listing_id_fkey";
            columns: ["notes_listing_id"];
            isOneToOne: false;
            referencedRelation: "notes_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      notes_requests: {
        Row: {
          branch: string | null;
          created_at: string;
          description: string;
          expires_at: string | null;
          id: string;
          request_type: string;
          requester_id: string;
          semester: string | null;
          status: Database["public"]["Enums"]["notes_request_status"];
          subject: string;
          updated_at: string;
          urgency_level: string;
        };
        Insert: {
          branch?: string | null;
          created_at?: string;
          description: string;
          expires_at?: string | null;
          id?: string;
          request_type: string;
          requester_id: string;
          semester?: string | null;
          status?: Database["public"]["Enums"]["notes_request_status"];
          subject: string;
          updated_at?: string;
          urgency_level?: string;
        };
        Update: {
          branch?: string | null;
          created_at?: string;
          description?: string;
          expires_at?: string | null;
          id?: string;
          request_type?: string;
          requester_id?: string;
          semester?: string | null;
          status?: Database["public"]["Enums"]["notes_request_status"];
          subject?: string;
          updated_at?: string;
          urgency_level?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          chats: boolean;
          desktop_enabled: boolean;
          email_enabled: boolean;
          food: boolean;
          marketplace: boolean;
          notes: boolean;
          push_enabled: boolean;
          rentals: boolean;
          requests: boolean;
          sound_enabled: boolean;
          system: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chats?: boolean;
          desktop_enabled?: boolean;
          email_enabled?: boolean;
          food?: boolean;
          marketplace?: boolean;
          notes?: boolean;
          push_enabled?: boolean;
          rentals?: boolean;
          requests?: boolean;
          sound_enabled?: boolean;
          system?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chats?: boolean;
          desktop_enabled?: boolean;
          email_enabled?: boolean;
          food?: boolean;
          marketplace?: boolean;
          notes?: boolean;
          push_enabled?: boolean;
          rentals?: boolean;
          requests?: boolean;
          sound_enabled?: boolean;
          system?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          action_url: string | null;
          created_at: string;
          description: string;
          id: string;
          metadata: Json | null;
          module: Database["public"]["Enums"]["notification_module"];
          priority: Database["public"]["Enums"]["notification_priority"];
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          action_url?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          metadata?: Json | null;
          module: Database["public"]["Enums"]["notification_module"];
          priority?: Database["public"]["Enums"]["notification_priority"];
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          action_url?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          metadata?: Json | null;
          module?: Database["public"]["Enums"]["notification_module"];
          priority?: Database["public"]["Enums"]["notification_priority"];
          read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          sort_index: number;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          sort_index: number;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          sort_index?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      product_listings: {
        Row: {
          category: string;
          condition: string;
          created_at: string;
          custom_category: string | null;
          description: string;
          id: string;
          is_negotiable: boolean | null;
          location: string | null;
          price: number;
          seller_id: string;
          status: Database["public"]["Enums"]["product_status"];
          title: string;
          updated_at: string;
          urgent_sale: boolean;
          views_count: number;
          wishlist_count: number | null;
        };
        Insert: {
          category: string;
          condition: string;
          created_at?: string;
          custom_category?: string | null;
          description: string;
          id?: string;
          is_negotiable?: boolean | null;
          location?: string | null;
          price: number;
          seller_id: string;
          status?: Database["public"]["Enums"]["product_status"];
          title: string;
          updated_at?: string;
          urgent_sale?: boolean;
          views_count?: number;
          wishlist_count?: number | null;
        };
        Update: {
          category?: string;
          condition?: string;
          created_at?: string;
          custom_category?: string | null;
          description?: string;
          id?: string;
          is_negotiable?: boolean | null;
          location?: string | null;
          price?: number;
          seller_id?: string;
          status?: Database["public"]["Enums"]["product_status"];
          title?: string;
          updated_at?: string;
          urgent_sale?: boolean;
          views_count?: number;
          wishlist_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      product_requests: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          message: string | null;
          offered_price: number | null;
          product_id: string;
          request_type: Database["public"]["Enums"]["product_request_type"];
          seller_id: string;
          status: Database["public"]["Enums"]["product_request_status"];
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          offered_price?: number | null;
          product_id: string;
          request_type?: Database["public"]["Enums"]["product_request_type"];
          seller_id: string;
          status?: Database["public"]["Enums"]["product_request_status"];
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          offered_price?: number | null;
          product_id?: string;
          request_type?: Database["public"]["Enums"]["product_request_type"];
          seller_id?: string;
          status?: Database["public"]["Enums"]["product_request_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_requests_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          hostel_block: string | null;
          hostel_type: string | null;
          id: string;
          is_profile_complete: boolean;
          phone_number: string | null;
          room_number: string | null;
          status: Database["public"]["Enums"]["account_status"];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          hostel_block?: string | null;
          hostel_type?: string | null;
          id: string;
          is_profile_complete?: boolean;
          phone_number?: string | null;
          room_number?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          hostel_block?: string | null;
          hostel_type?: string | null;
          id?: string;
          is_profile_complete?: boolean;
          phone_number?: string | null;
          room_number?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      rental_images: {
        Row: {
          created_at: string;
          id: string;
          rental_id: string;
          sort_index: number;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rental_id: string;
          sort_index: number;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rental_id?: string;
          sort_index?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_images_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rental_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_listings: {
        Row: {
          category: string;
          condition: string;
          created_at: string;
          custom_category: string | null;
          description: string;
          id: string;
          rent_price_per_day: number;
          seller_id: string;
          status: Database["public"]["Enums"]["rental_status"];
          title: string;
          updated_at: string;
          views_count: number;
          wishlist_count: number;
        };
        Insert: {
          category: string;
          condition: string;
          created_at?: string;
          custom_category?: string | null;
          description: string;
          id?: string;
          rent_price_per_day: number;
          seller_id: string;
          status?: Database["public"]["Enums"]["rental_status"];
          title: string;
          updated_at?: string;
          views_count?: number;
          wishlist_count?: number;
        };
        Update: {
          category?: string;
          condition?: string;
          created_at?: string;
          custom_category?: string | null;
          description?: string;
          id?: string;
          rent_price_per_day?: number;
          seller_id?: string;
          status?: Database["public"]["Enums"]["rental_status"];
          title?: string;
          updated_at?: string;
          views_count?: number;
          wishlist_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rental_listings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      rental_requests: {
        Row: {
          buyer_id: string;
          created_at: string;
          id: string;
          message: string | null;
          rental_id: string;
          seller_id: string;
          status: Database["public"]["Enums"]["rental_request_status"];
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          rental_id: string;
          seller_id: string;
          status?: Database["public"]["Enums"]["rental_request_status"];
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          rental_id?: string;
          seller_id?: string;
          status?: Database["public"]["Enums"]["rental_request_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_requests_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rental_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          food_listing_id: string | null;
          id: string;
          notes_listing_id: string | null;
          product_id: string | null;
          reason: string;
          rental_id: string | null;
          reporter_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          seller_user_id: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_type: Database["public"]["Enums"]["report_target_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          food_listing_id?: string | null;
          id?: string;
          notes_listing_id?: string | null;
          product_id?: string | null;
          reason: string;
          rental_id?: string | null;
          reporter_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          seller_user_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_type: Database["public"]["Enums"]["report_target_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          food_listing_id?: string | null;
          id?: string;
          notes_listing_id?: string | null;
          product_id?: string | null;
          reason?: string;
          rental_id?: string | null;
          reporter_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          seller_user_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_type?: Database["public"]["Enums"]["report_target_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_food_listing_id_fkey";
            columns: ["food_listing_id"];
            isOneToOne: false;
            referencedRelation: "food_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_notes_listing_id_fkey";
            columns: ["notes_listing_id"];
            isOneToOne: false;
            referencedRelation: "notes_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "product_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rental_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          joined_at: string;
          rating_avg: number;
          rating_count: number;
          slug: string;
          total_rented_out: number;
          total_sold: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          joined_at?: string;
          rating_avg?: number;
          rating_count?: number;
          slug: string;
          total_rented_out?: number;
          total_sold?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          joined_at?: string;
          rating_avg?: number;
          rating_count?: number;
          slug?: string;
          total_rented_out?: number;
          total_sold?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      suspicious_flags: {
        Row: {
          created_at: string;
          flag_type: string;
          id: string;
          metadata: Json;
          resolved: boolean;
          score: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          flag_type: string;
          id?: string;
          metadata?: Json;
          resolved?: boolean;
          score?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          flag_type?: string;
          id?: string;
          metadata?: Json;
          resolved?: boolean;
          score?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_presence: {
        Row: {
          is_online: boolean;
          last_seen_at: string;
          typing_conversation_id: string | null;
          typing_updated_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          is_online?: boolean;
          last_seen_at?: string;
          typing_conversation_id?: string | null;
          typing_updated_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          is_online?: boolean;
          last_seen_at?: string;
          typing_conversation_id?: string | null;
          typing_updated_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_presence_typing_conversation_id_fkey";
            columns: ["typing_conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          created_at: string | null;
          id: string;
          item_id: string | null;
          item_type: string | null;
          listing_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          item_id?: string | null;
          item_type?: string | null;
          listing_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          item_id?: string | null;
          item_type?: string | null;
          listing_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_access_conversation: {
        Args: { p_conversation_id: string; p_reason: string };
        Returns: undefined;
      };
      can_admin_read_conversation: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      generate_seller_slug: { Args: { _name: string }; Returns: string };
      get_or_create_conversation: {
        Args: {
          p_buyer_id: string;
          p_context_id: string;
          p_context_type: Database["public"]["Enums"]["chat_context_type"];
          p_listing_title: string;
          p_request_id: string;
          p_seller_id: string;
        };
        Returns: string;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      increment_listing_view: {
        Args: { p_item_id: string; p_item_type: string };
        Returns: undefined;
      };
      is_conversation_participant: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_status: "active" | "suspended" | "banned";
      admin_action_type: "suspend_user" | "ban_user" | "remove_product";
      app_role: "user" | "admin";
      chat_context_type: "product" | "rental" | "food" | "notes";
      chat_report_reason:
        | "spam"
        | "abuse"
        | "harassment"
        | "scam"
        | "fake_listing"
        | "inappropriate"
        | "other";
      chat_report_target: "user" | "conversation" | "listing";
      conversation_status: "active" | "archived" | "reported" | "completed";
      food_listing_status: "available" | "hidden" | "expired" | "sold";
      food_order_status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
      food_request_status: "open" | "fulfilled" | "expired" | "closed";
      message_delivery_status: "sent" | "delivered" | "read";
      message_type: "text" | "image";
      notes_listing_type: "sell" | "rent";
      notes_purchase_status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
      notes_request_status: "open" | "fulfilled" | "expired" | "closed";
      notes_status: "available" | "rented_out" | "unavailable" | "hidden";
      notification_module:
        | "marketplace"
        | "rentals"
        | "notes"
        | "food"
        | "chats"
        | "requests"
        | "system";
      notification_priority: "critical" | "important" | "informational";
      product_request_status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
      product_request_type: "buy" | "offer";
      product_status: "available" | "sold" | "hidden";
      rental_request_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "returned"
        | "completed"
        | "cancelled";
      rental_status: "available" | "rented_out" | "unavailable";
      report_status: "pending" | "resolved" | "dismissed";
      report_target_type: "product" | "seller" | "rental" | "food" | "notes";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "banned"],
      admin_action_type: ["suspend_user", "ban_user", "remove_product"],
      app_role: ["user", "admin"],
      chat_context_type: ["product", "rental", "food", "notes"],
      chat_report_reason: [
        "spam",
        "abuse",
        "harassment",
        "scam",
        "fake_listing",
        "inappropriate",
        "other",
      ],
      chat_report_target: ["user", "conversation", "listing"],
      conversation_status: ["active", "archived", "reported", "completed"],
      food_listing_status: ["available", "hidden", "expired", "sold"],
      food_order_status: ["pending", "accepted", "rejected", "completed", "cancelled"],
      food_request_status: ["open", "fulfilled", "expired", "closed"],
      message_delivery_status: ["sent", "delivered", "read"],
      message_type: ["text", "image"],
      notes_listing_type: ["sell", "rent"],
      notes_purchase_status: ["pending", "accepted", "rejected", "completed", "cancelled"],
      notes_request_status: ["open", "fulfilled", "expired", "closed"],
      notes_status: ["available", "rented_out", "unavailable", "hidden"],
      notification_module: [
        "marketplace",
        "rentals",
        "notes",
        "food",
        "chats",
        "requests",
        "system",
      ],
      notification_priority: ["critical", "important", "informational"],
      product_request_status: ["pending", "accepted", "rejected", "completed", "cancelled"],
      product_request_type: ["buy", "offer"],
      product_status: ["available", "sold", "hidden"],
      rental_request_status: [
        "pending",
        "accepted",
        "rejected",
        "returned",
        "completed",
        "cancelled",
      ],
      rental_status: ["available", "rented_out", "unavailable"],
      report_status: ["pending", "resolved", "dismissed"],
      report_target_type: ["product", "seller", "rental", "food", "notes"],
    },
  },
} as const;
