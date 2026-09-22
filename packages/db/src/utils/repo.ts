import { and, count, type InferInsertModel, type InferSelectModel, type SQL } from "drizzle-orm";
import type { PgTable, TableConfig } from "drizzle-orm/pg-core";
import { db } from "@/db";

// Явно указываем, что TTable расширяет PgTable с конфигурацией
export function CreateBaseRepo<TTable extends PgTable<TableConfig>>(table: TTable) {
    type SelectModel = InferSelectModel<TTable>;
    type InsertModel = InferInsertModel<TTable>;

    return {
        async findOne(filters: (SQL | undefined)[]): Promise<SelectModel | null> {
            // @ts-expect-error: TS не может вычислить условные типы Drizzle для дженерика TTable
            const query = db.select().from(table).$dynamic();
            if (filters.length > 0) query.where(and(...filters));

            const result = await query.limit(1);
            // Двойное приведение через unknown безопасно и не нарушает strict mode
            return (result[0] as unknown as SelectModel) || null;
        },

        async findMany(filters?: (SQL | undefined)[], limit?: number): Promise<SelectModel[]> {
            // @ts-expect-error: TS limitation
            const query = db.select().from(table).$dynamic();
            if (filters && filters.length > 0) query.where(and(...filters));
            if (limit) query.limit(limit);

            return (await query) as unknown as SelectModel[];
        },

        async findPaginated(
            page: number,
            perPage: number,
            filters?: (SQL | undefined)[]
        ): Promise<{ data: SelectModel[]; total: number; totalPages: number }> {
            const offset = (page - 1) * perPage;
            const condition = filters && filters.length > 0 ? and(...filters) : undefined;

            // @ts-expect-error: TS limitation
            const dataQuery = db.select().from(table).where(condition).limit(perPage).offset(offset);
            // @ts-expect-error: TS limitation
            const countQuery = db.select({ value: count() }).from(table).where(condition);

            const [dataResult, countResult] = await Promise.all([dataQuery, countQuery]);

            const total = (countResult[0] as unknown as { value: number })?.value ?? 0;

            return {
                data: dataResult as unknown as SelectModel[],
                total,
                totalPages: Math.ceil(total / perPage),
            };
        },

        async create(data: InsertModel): Promise<SelectModel> {
            // @ts-expect-error: TS limitation
            const result = await db.insert(table).values(data).returning();
            return result[0] as unknown as SelectModel;
        },

        async update(data: Partial<InsertModel>, filters: (SQL | undefined)[]): Promise<SelectModel[]> {
            if (!filters.length) throw new Error("Update requires at least one filter");


            const result = await db
                .update(table)
                .set(data)
                .where(and(...filters))
                .returning();

            return result as unknown as SelectModel[];
        },

        async delete(filters: (SQL | undefined)[]): Promise<SelectModel[]> {
            if (!filters.length) throw new Error("Delete requires at least one filter");

            const result = await db.delete(table).where(and(...filters)).returning();

            return result as unknown as SelectModel[];
        },
    };
}
