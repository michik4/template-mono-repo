import { defineRelations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const UserStatusArray = ['inactive', 'active', 'banned'] as const;
export type UserStatus = typeof UserStatusArray[number];
export const userStatusEnum = pgEnum('user_status', UserStatusArray);

export const usersTable = pgTable("users", {
    id: uuid()
        .defaultRandom()
        .primaryKey(),

    email: varchar({ length: 254 })
        .notNull(),

    status: userStatusEnum()
        .default('inactive')
        .notNull()
});

/**
 * Таблица для профиля пользователя 
 */
export const usersProfileTable = pgTable("users_profiles", {
    userId: uuid('user_id')
        .primaryKey(),

    bio: varchar({ length: 4000 })
});

/**
 * Таблица для сервисных нужд 
 */
export const usersServiceTable = pgTable('users_service', {
    userId: uuid('user_id')
        .primaryKey()
        .references(() => usersTable.id, { onDelete: 'cascade' }),

    banReason: varchar('ban_reason', { length: 1000 }),

    /**
     * admin id
     */
    bannedBy: uuid('banned_by').references(() => usersTable.id, { onDelete: 'no action' }),

    isEmailVerified: boolean('is_email_verified').default(false).notNull(),
})

export const rel = defineRelations({ usersTable, usersProfileTable, usersServiceTable }, (r) => ({

    usersTable: {
        profile: r.one.usersProfileTable({
            from: r.usersTable.id,
            to: r.usersProfileTable.userId
        }),

        service: r.one.usersServiceTable({
            from: r.usersTable.id,
            to: r.usersServiceTable.userId
        })
    },

    usersProfileTable: {
        user: r.one.usersTable({
            from: r.usersProfileTable.userId,
            to: r.usersTable.id
        })
    },

    usersServiceTable: {
        user: r.one.usersTable({
            from: r.usersServiceTable.userId,
            to: r.usersTable.id
        })
    }
}));

export const UserSelectSchem = createSelectSchema(usersTable);
export const UserProfileSelectSchem = createSelectSchema(usersProfileTable);