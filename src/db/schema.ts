import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, real, primaryKey, index, customType, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const clipVector = customType<{ data: number[]; driverData: string }>({
    dataType() {
        return 'vector(512)';
    },
    toDriver(value: number[]) {
        return `[${value.join(`,`)}]`;
    },
    fromDriver(value: string) {
        return JSON.parse(value);
    }
});

const fVector = customType<{ data: number[]; driverData: string }>({
    dataType() {
        return 'vector(512)';
    },
    toDriver(value: number[]) {
        return `[${value.join(',')}]`;
    },
    fromDriver(value: string) {
        return JSON.parse(value);
    }
});

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    username: text('username').unique().notNull(),
    email: text('email').unique().notNull(),
    passwordHash: text('password_hash'),
    roleId: uuid('role_id').references(() => roles.id).notNull(),
    mfaSecret: text('mfa_secret'),
    mfaEnabled: boolean('mfa_enabled').default(false),
    storageQuota: integer('storage_quota'),
    storageUsed: integer('storage_used').default(0),
    isSuspended: boolean('is_suspended').default(false),
    lockedFolderPin: text('locked_folder_pin'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    UpdatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').unique().notNull(),
    isSystem: boolean('is_system').default(false),
    permissions: jsonb('permissions').notNull().$type<{
        can_manage_users: boolean;
        can_manage_server: boolean;
        can_view_analytics: boolean;
        can_change_config: boolean;
        can_manage_flippers: boolean;
        can_view_audit_log: boolean;
        can_manage_others_albums: boolean;
        can_view_all_media: boolean;
        can_override_quota: boolean;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
    id: text('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    deviceInfo: text('device_info').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
});

export const storageBackends = pgTable('storage_backends', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    config: jsonb('config').notNull(),
    isDefault: boolean('is_defailt').default(false),
    status: text('status').default('online'),
    createdAt: timestamp('created_at').defaultNow().notNull()
});

export const platformConfig = pgTable('platform_config', {
    key: text('key').primaryKey(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const media = pgTable('media', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    storageBackendId: uuid('storage_backend_id').references(() => storageBackends.id),
    filename: text('filename').notNull(),
    mimetype: text('mimetype').notNull(),
    size: integer('size').notNull(),
    hash: text('hash').notNull(),
    objectKey: text('object_key').notNull(),
    thumbnails: jsonb('thumbnails').$type<{
        small?: string;
        medium?: string;
        large?: string;
    } | null>().default(null),

    width: integer('width'),
    height: integer('height'),
    duration: real('duration'),
    dateTaken: timestamp('date_taken'),
    cameraModel: text('camera_model'), // idk if this should be here
    lensModel: text('lens_model'), // idk if this should be here
    gpsLat: real('gps_lat'),
    gpsLng: real('gps_lng'),
    locationCity: text('location_city'),
    locationState: text('location_state'),
    locationCountry: text('location_country'),
    caption: text('caption'),
    isArchived: boolean('is_archived').default(false),
    isFavorited: boolean('is_favorited').default(false),
    isDeleted: boolean('is_deleted').default(false),
    isEncrypted: boolean('is_encrypted').default(true),
    isLocked: boolean('is_locked').default(false),
    blurScore: real('blue_score'),
    aestheticScore: real('aesthetic_score'),
    clipEmbedding: clipVector('clip_embedding'),
    extractedText: text('extracted_text'),
    hoverSpriteKey: text('hover_sprite_key'),
    hlsPlaylistKey: text('hls_playlist_key'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => [
    index('media_timeline_idx').on(table.ownerId, table.isDeleted, table.isArchived, table.isLocked, table.dateTaken.desc(), table.createdAt.desc()),
    index('media_hash_idx').on(table.hash),
    index('media_favorites.idx').on(table.ownerId, table.isFavorited),
    index('media_hnsw_idx').using('hnsw', table.clipEmbedding.op('vector_cosine_ops')),
    index('media_aesthetic_idx').on(table.ownerId, table.aestheticScore)
]);

export const albums = pgTable('albums', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    coverMediaId: uuid('cover_media_id').references(() => media.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const albumMedia = pgTable('album_media', {
    albumId: uuid('album_id').references(() => albums.id, { onDelete: 'cascade' }).notNull(),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }).notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.albumId, t.mediaId] })]);

export const albumContributors = pgTable('album_contributors', {
    albumId: uuid('album_id').references(() => albums.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').default('viewer').notNull(),
    grantedAt: timestamp('granted_at').defaultNow().notNull(),

}, (t) => [primaryKey({ columns: [t.albumId, t.userId] })]);

export const tags = pgTable('tags', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
}, (table) => [
    uniqueIndex('tags_owner_name_uidx').on(table.ownerId, table.name)
]);

export const mediaTags = pgTable('media_tags', {
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }).notNull(),
    tagId: uuid('tag_id').references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [primaryKey({ columns: [t.mediaId, t.tagId] })]);

export const shareLinks = pgTable('share_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    linkToken: text('link_token').unique().notNull(),
    isPublic: boolean('is_public').default(true),
    passwordHash: text('password_hash'),
    allowDownload: boolean('allow_download').default(true),
    allowUpload: boolean('allow_upload').default(false),
    requireLogin: boolean('require_login').default(false),
    viewCount: integer('view_count').default(0),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    details: jsonb('details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userRelations = relations(users, ({ one, many }) => ({
    role: one(roles, { fields: [users.roleId], references: [roles.id] }),
    media: many(media),
    albums: many(albums),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
    owner: one(users, { fields: [media.ownerId], references: [users.id] }),
    storageBackend: one(storageBackends, { fields: [media.storageBackendId], references: [storageBackends.id]
}),
  tags: many(mediaTags),
  albums: many(albumMedia),
}));

export const albumRelations = relations(albums, ({ one, many }) => ({
    owner: one(users, { fields: [albums.ownerId], references: [users.id] }),
    media: many(albumMedia),
    contributors: many(albumContributors),
}));

export const people = pgTable('people', {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    coverFaceId: uuid('cover_face_id'),
    isHidden: boolean('is_hidden').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const faces = pgTable('faces', {
    id: uuid('id').defaultRandom().primaryKey(),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'cascade' }).notNull(),
    personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }), //todo
    boundingBox: jsonb('bounding_box').notNull().$type<{
        x: number; y: number; w: number; h: number;
    }>(),
    faceEmbedding: fVector('face_embedding'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('faces_media_idx').on(table.mediaId),
    index('faces_person_idx').on(table.personId),
    index('faces_embedding_hnsw_idx').using('hnsw', table.faceEmbedding.op('vector_cosine_ops'))
]);

export const peopleRelations = relations(people, ({ one, many }) => ({
    owner: one(users, { fields: [people.ownerId], references: [users.id] }),
    faces: many(faces),
}));

export const facesRelations = relations(faces, ({ one }) => ({
    media: one(media, { fields: [faces.mediaId], references: [media.id] }),
    person: one(people, { fields: [faces.personId], references: [people.id] }),
}));