import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const groupType = pgEnum("group_type", ["friends", "class"]);
export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const reactionKind = pgEnum("reaction_kind", [
  "fire",
  "clap",
  "brain",
  "muscle",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const profiles = pgTable(
  "profiles",
  {
    // Neon Auth user id. No FK across the managed schema.
    userId: text("user_id").primaryKey(),
    displayName: text("display_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "profiles_display_name_len",
      sql`char_length(${t.displayName}) between 1 and 40`,
    ),
  ],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: groupType("type").notNull(),
    inviteCode: text("invite_code").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => profiles.userId),
    createdAt: createdAt(),
  },
  (t) => [
    check("groups_name_len", sql`char_length(${t.name}) between 1 and 40`),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("memberships_user_id_idx").on(t.userId),
  ],
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    subject: text("subject"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // null means the session is running
    endedAt: timestamp("ended_at", { withTimezone: true }),
    minutes: integer("minutes"),
    photoKey: text("photo_key").unique(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "study_sessions_subject_len",
      sql`${t.subject} is null or char_length(${t.subject}) <= 60`,
    ),
    check(
      "study_sessions_minutes_range",
      sql`${t.minutes} between 0 and 360`,
    ),
    check(
      "study_sessions_ended_iff_minutes",
      sql`(${t.endedAt} is null) = (${t.minutes} is null)`,
    ),
    check(
      "study_sessions_ended_after_started",
      sql`${t.endedAt} is null or ${t.endedAt} >= ${t.startedAt}`,
    ),
    // At most one running timer per user, enforced by the database.
    uniqueIndex("study_sessions_one_running_per_user")
      .on(t.userId)
      .where(sql`${t.endedAt} is null`),
    index("study_sessions_user_ended_idx").on(t.userId, t.endedAt.desc()),
  ],
);

export const reactions = pgTable(
  "reactions",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studySessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    kind: reactionKind("kind").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId, t.kind] })],
);
