import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import * as dotenv from "dotenv"

dotenv.config({ path: "../../apps/web/.env" })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

const migrationClient = postgres(connectionString, { max: 1 })

async function main() {
  const db = drizzle(migrationClient)
  console.log("Running migrations...")
  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("Migrations complete")
  await migrationClient.end()
}

main().catch((e) => {
  console.error("Migration failed", e)
  process.exit(1)
})
