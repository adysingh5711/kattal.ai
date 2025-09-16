import postgres from 'postgres'
import { env } from "./src/lib/env"

const connectionString = env.DATABASE_URL

const sql = postgres(connectionString, {
    ssl: 'require',          // Always require SSL in prod!
    max: 10,                 // Max simultaneous connections
    idle_timeout: 60,        // Pool idle timeout in seconds
    connect_timeout: 30      // Connection timeout in seconds
});

export default sql
