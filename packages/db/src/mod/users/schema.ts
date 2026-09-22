import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const usersTable = pgTable("users", {
    id: uuid().defaultRandom().primaryKey(),
    email: varchar({ length: 254 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const UserSelectSchema = createSelectSchema(usersTable);