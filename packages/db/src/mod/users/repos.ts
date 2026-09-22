import { CreateBaseRepo } from "@utils/repo";
import { usersTable } from "./schema";
import { eq } from "drizzle-orm";


const baseUserRepos = CreateBaseRepo(usersTable);

const userCustomMethods = {
    async findByEmail(email: string) {
        return await baseUserRepos.findOne([eq(usersTable.email, email)]);
    }
}

export const userRepo = Object.assign({}, baseUserRepos, userCustomMethods);