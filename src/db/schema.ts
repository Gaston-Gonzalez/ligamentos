import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const championships = pgTable("championships", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  series: varchar("series", { length: 40 }),
  division: varchar("division", { length: 40 }),
  ligaproUrl: text("ligapro_url"),
  ligaproGalleryUrl: text("ligapro_gallery_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  number: integer("number"),
  position: varchar("position", { length: 60 }),
  photoUrl: text("photo_url"),
  /** JSON: { x, y, zoom } for avatar framing */
  photoCrop: text("photo_crop"),
  aliases: text("aliases").array().default([]).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  championshipId: integer("championship_id")
    .notNull()
    .references(() => championships.id),
  matchIndex: integer("match_index"),
  date: date("date"),
  rival: varchar("rival", { length: 160 }).notNull(),
  pitch: integer("pitch"),
  goalsFor: integer("goals_for").default(0).notNull(),
  goalsAgainst: integer("goals_against").default(0).notNull(),
  result: varchar("result", { length: 1 }),
  jornada: integer("jornada"),
  youtubeUrl: text("youtube_url"),
  ligaproAlbumId: varchar("ligapro_album_id", { length: 40 }),
  ligaproAlbumUrl: text("ligapro_album_url"),
  /** Cover image for match cards (usually a Liga Pro photo URL). */
  coverImageUrl: text("cover_image_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendances = pgTable(
  "attendances",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 32 }).notNull(),
  },
  (t) => [uniqueIndex("attendance_match_player").on(t.matchId, t.playerId)],
);

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  playerId: integer("player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  isOwnGoal: boolean("is_own_goal").default(false).notNull(),
  minute: integer("minute"),
});

export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    imageUrl: text("image_url").notNull(),
    sourcePageUrl: text("source_page_url"),
    championshipId: integer("championship_id").references(
      () => championships.id,
      { onDelete: "set null" },
    ),
    matchId: integer("match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    caption: text("caption"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("photos_image_url").on(t.imageUrl)],
);

export const photoTags = pgTable(
  "photo_tags",
  {
    id: serial("id").primaryKey(),
    photoId: integer("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("photo_tag_unique").on(t.photoId, t.playerId)],
);

export type Championship = typeof championships.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type PhotoTag = typeof photoTags.$inferSelect;
