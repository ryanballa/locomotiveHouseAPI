import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.dev.vars' });

const sql = postgres(process.env.DATABASE_URL || '', { ssl: 'require' });

async function checkData() {
  try {
    // Get users
    const users = await sql`SELECT id, token FROM users LIMIT 10`;
    console.log('Users:', users);
    
    // Get towers
    const towers = await sql`SELECT id, name, club_id FROM towers`;
    console.log('Towers:', towers);
    
    // Check if owner_id column exists
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'towers'
      ORDER BY column_name
    `;
    console.log('Tower columns:', columns);
    
    await sql.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkData();
