export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          id: string
          name: string
          path: string | null
          props: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          path?: string | null
          props?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          path?: string | null
          props?: Json | null
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          status: Database["public"]["Enums"]["comment_status"]
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          status?: Database["public"]["Enums"]["comment_status"]
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          status?: Database["public"]["Enums"]["comment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          body: string
          created_at: string
          email: string
          email_sent: boolean
          id: string
          name: string
          read: boolean
          subject: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          email_sent?: boolean
          id?: string
          name: string
          read?: boolean
          subject?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          email_sent?: boolean
          id?: string
          name?: string
          read?: boolean
          subject?: string | null
        }
        Relationships: []
      }
      error_alerts: {
        Row: {
          fingerprint: string
          first_seen: string
          last_emailed_at: string | null
          last_seen: string
          occurrences: number
        }
        Insert: {
          fingerprint: string
          first_seen?: string
          last_emailed_at?: string | null
          last_seen?: string
          occurrences?: number
        }
        Update: {
          fingerprint?: string
          first_seen?: string
          last_emailed_at?: string | null
          last_seen?: string
          occurrences?: number
        }
        Relationships: []
      }
      media: {
        Row: {
          alt: string | null
          content_type: string | null
          created_at: string
          height: number | null
          path: string
          size_bytes: number | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt?: string | null
          content_type?: string | null
          created_at?: string
          height?: number | null
          path: string
          size_bytes?: number | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt?: string | null
          content_type?: string | null
          created_at?: string
          height?: number | null
          path?: string
          size_bytes?: number | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_terms: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["term_kind"]
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["term_kind"]
          term: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["term_kind"]
          term?: string
        }
        Relationships: []
      }
      newsletter_confirmations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          token?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          body_html: string
          body_md: string
          created_at: string
          enabled: boolean
          id: string
          seo_description: string | null
          show_in_footer: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          body_md?: string
          created_at?: string
          enabled?: boolean
          id?: string
          seo_description?: string | null
          show_in_footer?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_md?: string
          created_at?: string
          enabled?: boolean
          id?: string
          seo_description?: string | null
          show_in_footer?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_revisions: {
        Row: {
          body_md: string | null
          canonical_url: string | null
          category_id: string | null
          cover_alt: string | null
          cover_image: string | null
          created_at: string
          edited_by: string | null
          excerpt: string | null
          id: string
          noindex: boolean
          og_image: string | null
          post_id: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          series_id: string | null
          series_order: number | null
          slug: string | null
          status: Database["public"]["Enums"]["post_status"] | null
          tags: string[]
          title: string | null
        }
        Insert: {
          body_md?: string | null
          canonical_url?: string | null
          category_id?: string | null
          cover_alt?: string | null
          cover_image?: string | null
          created_at?: string
          edited_by?: string | null
          excerpt?: string | null
          id?: string
          noindex?: boolean
          og_image?: string | null
          post_id: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          series_id?: string | null
          series_order?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["post_status"] | null
          tags?: string[]
          title?: string | null
        }
        Update: {
          body_md?: string | null
          canonical_url?: string | null
          category_id?: string | null
          cover_alt?: string | null
          cover_image?: string | null
          created_at?: string
          edited_by?: string | null
          excerpt?: string | null
          id?: string
          noindex?: boolean
          og_image?: string | null
          post_id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          series_id?: string | null
          series_order?: number | null
          slug?: string | null
          status?: Database["public"]["Enums"]["post_status"] | null
          tags?: string[]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_revisions_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_revisions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          body_html: string
          body_md: string
          canonical_url: string | null
          category_id: string | null
          cover_alt: string | null
          cover_image: string | null
          created_at: string
          excerpt: string | null
          id: string
          newsletter_sent_at: string | null
          noindex: boolean
          og_image: string | null
          published_at: string | null
          reading_minutes: number | null
          search_tsv: unknown
          seo_description: string | null
          seo_title: string | null
          series_id: string | null
          series_order: number | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_html: string
          body_md: string
          canonical_url?: string | null
          category_id?: string | null
          cover_alt?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          newsletter_sent_at?: string | null
          noindex?: boolean
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number | null
          search_tsv?: unknown
          seo_description?: string | null
          seo_title?: string | null
          series_id?: string | null
          series_order?: number | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_html?: string
          body_md?: string
          canonical_url?: string | null
          category_id?: string | null
          cover_alt?: string | null
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          newsletter_sent_at?: string | null
          noindex?: boolean
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number | null
          search_tsv?: unknown
          seo_description?: string | null
          seo_title?: string | null
          series_id?: string | null
          series_order?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          blocked_at: string | null
          blocked_reason: string | null
          bluesky_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          github_url: string | null
          id: string
          is_blocked: boolean
          linkedin_url: string | null
          mastodon_url: string | null
          notify_on_reply: boolean
          role: Database["public"]["Enums"]["user_role"]
          website_url: string | null
          x_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          bluesky_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          github_url?: string | null
          id: string
          is_blocked?: boolean
          linkedin_url?: string | null
          mastodon_url?: string | null
          notify_on_reply?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          website_url?: string | null
          x_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          bluesky_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          github_url?: string | null
          id?: string
          is_blocked?: boolean
          linkedin_url?: string | null
          mastodon_url?: string | null
          notify_on_reply?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          website_url?: string | null
          x_url?: string | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          auto_newsletter_include_authors: boolean
          auto_newsletter_on_publish: boolean
          brand_icon_path: string | null
          brand_icon_version: number
          bulk_publish_sends_newsletter: boolean
          contact_email: string | null
          contact_enabled: boolean
          home_intro: string | null
          home_intro_enabled: boolean
          id: boolean
          max_links_per_comment: number
          newsletter_prompt_delay_seconds: number
          newsletter_prompt_redisplay_days: number
          newsletter_prompt_scroll_pct: number
          newsletter_prompt_trigger: string
          notify_on_comment: boolean
          rate_limit_seconds: number
          require_comment_approval: boolean
          site_description: string | null
          site_locale: string | null
          site_name: string | null
          theme_default: Json
          theme_overrides: Json
        }
        Insert: {
          auto_newsletter_include_authors?: boolean
          auto_newsletter_on_publish?: boolean
          brand_icon_path?: string | null
          brand_icon_version?: number
          bulk_publish_sends_newsletter?: boolean
          contact_email?: string | null
          contact_enabled?: boolean
          home_intro?: string | null
          home_intro_enabled?: boolean
          id?: boolean
          max_links_per_comment?: number
          newsletter_prompt_delay_seconds?: number
          newsletter_prompt_redisplay_days?: number
          newsletter_prompt_scroll_pct?: number
          newsletter_prompt_trigger?: string
          notify_on_comment?: boolean
          rate_limit_seconds?: number
          require_comment_approval?: boolean
          site_description?: string | null
          site_locale?: string | null
          site_name?: string | null
          theme_default?: Json
          theme_overrides?: Json
        }
        Update: {
          auto_newsletter_include_authors?: boolean
          auto_newsletter_on_publish?: boolean
          brand_icon_path?: string | null
          brand_icon_version?: number
          bulk_publish_sends_newsletter?: boolean
          contact_email?: string | null
          contact_enabled?: boolean
          home_intro?: string | null
          home_intro_enabled?: boolean
          id?: boolean
          max_links_per_comment?: number
          newsletter_prompt_delay_seconds?: number
          newsletter_prompt_redisplay_days?: number
          newsletter_prompt_scroll_pct?: number
          newsletter_prompt_trigger?: string
          notify_on_comment?: boolean
          rate_limit_seconds?: number
          require_comment_approval?: boolean
          site_description?: string | null
          site_locale?: string | null
          site_name?: string | null
          theme_default?: Json
          theme_overrides?: Json
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_categories: {
        Args: never
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      active_tags: {
        Args: never
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      analytics_summary: { Args: { p_days?: number }; Returns: Json }
      category_counts: {
        Args: never
        Returns: {
          id: string
          name: string
          published: number
          slug: string
          total: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_author: { Args: never; Returns: boolean }
      is_blocked: { Args: never; Returns: boolean }
      published_series: {
        Args: never
        Returns: {
          description: string
          id: string
          published: number
          slug: string
          title: string
        }[]
      }
      record_error_alert: {
        Args: { p_fingerprint: string }
        Returns: {
          first_seen: string
          last_emailed_at: string
          occurrences: number
        }[]
      }
      series_counts: {
        Args: never
        Returns: {
          description: string
          id: string
          published: number
          slug: string
          title: string
          total: number
        }[]
      }
      tag_counts: {
        Args: never
        Returns: {
          id: string
          name: string
          published: number
          slug: string
          total: number
        }[]
      }
    }
    Enums: {
      comment_status: "visible" | "hidden" | "pending"
      post_status: "draft" | "published"
      term_kind: "allow" | "block"
      user_role: "reader" | "author" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      comment_status: ["visible", "hidden", "pending"],
      post_status: ["draft", "published"],
      term_kind: ["allow", "block"],
      user_role: ["reader", "author", "admin"],
    },
  },
} as const
