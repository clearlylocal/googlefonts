import 'https://deno.land/x/dotenv@v3.2.0/load.ts'
import { apiServer } from './server/routes.ts'

await apiServer()
