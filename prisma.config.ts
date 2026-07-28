import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrate: {
    adapter: async () => {
      return new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      });
    },
  },
});
