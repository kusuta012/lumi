CREATE TABLE "album_contributors" (
	"album_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "album_contributors_album_id_user_id_pk" PRIMARY KEY("album_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "album_media" (
	"album_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "album_media_album_id_media_id_pk" PRIMARY KEY("album_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cover_media_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"person_id" uuid,
	"bounding_box" jsonb NOT NULL,
	"face_embedding" vector(512),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"storage_backend_id" uuid,
	"filename" text NOT NULL,
	"mimetype" text NOT NULL,
	"size" integer NOT NULL,
	"hash" text NOT NULL,
	"object_key" text NOT NULL,
	"thumbnails" jsonb DEFAULT 'null'::jsonb,
	"width" integer,
	"height" integer,
	"duration" real,
	"date_taken" timestamp,
	"camera_model" text,
	"lens_model" text,
	"gps_lat" real,
	"gps_lng" real,
	"caption" text,
	"is_archived" boolean DEFAULT false,
	"is_favorited" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"is_encrypted" boolean DEFAULT true,
	"is_locked" boolean DEFAULT false,
	"blue_score" real,
	"clip_embedding" vector(512),
	"extracted_text" text,
	"hover_sprite_key" text,
	"hls_playlist_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"media_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "media_tags_media_id_tag_id_pk" PRIMARY KEY("media_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cover_face_id" uuid,
	"is_hidden" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_info" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"link_token" text NOT NULL,
	"is_public" boolean DEFAULT true,
	"password_hash" text,
	"allow_download" boolean DEFAULT true,
	"allow_upload" boolean DEFAULT false,
	"require_login" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_link_token_unique" UNIQUE("link_token")
);
--> statement-breakpoint
CREATE TABLE "storage_backends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_defailt" boolean DEFAULT false,
	"status" text DEFAULT 'online',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role_id" uuid NOT NULL,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false,
	"storage_quota" integer,
	"storage_used" integer DEFAULT 0,
	"is_suspended" boolean DEFAULT false,
	"locked_folder_pin" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "album_contributors" ADD CONSTRAINT "album_contributors_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_contributors" ADD CONSTRAINT "album_contributors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_media" ADD CONSTRAINT "album_media_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_media" ADD CONSTRAINT "album_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faces" ADD CONSTRAINT "faces_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faces" ADD CONSTRAINT "faces_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_storage_backend_id_storage_backends_id_fk" FOREIGN KEY ("storage_backend_id") REFERENCES "public"."storage_backends"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faces_media_idx" ON "faces" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "faces_person_idx" ON "faces" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "faces_embedding_hnsw_idx" ON "faces" USING hnsw ("face_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "media_timeline_idx" ON "media" USING btree ("owner_id","is_deleted","is_archived","is_locked");--> statement-breakpoint
CREATE INDEX "media_date_idx" ON "media" USING btree ("date_taken","created_at");--> statement-breakpoint
CREATE INDEX "media_hash_idx" ON "media" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "media_favorites.idx" ON "media" USING btree ("owner_id","is_favorited");--> statement-breakpoint
CREATE INDEX "media_hnsw_idx" ON "media" USING hnsw ("clip_embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "tags_owner_name_uidx" ON "tags" USING btree ("owner_id","name");