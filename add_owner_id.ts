import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.dev.vars' });

const sql = postgres(process.env.DATABASE_URL || '', { ssl: 'require' });

async function addOwnerIdColumn() {
  try {
    console.log('Adding owner_id column to towers...');
    
    // Add the column
    const result1 = await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE towers ADD COLUMN owner_id integer NOT NULL DEFAULT 1;
      EXCEPTION
        WHEN duplicate_column THEN 
          RAISE NOTICE 'Column owner_id already exists';
      END $$;
    `);
    
    console.log('Column add result:', result1);
    
    // Drop the default
    const result2 = await sql.unsafe(`ALTER TABLE towers ALTER COLUMN owner_id DROP DEFAULT;`);
    console.log('Default drop result:', result2);
    
    // Add foreign key
    const result3 = await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE towers ADD CONSTRAINT towers_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES users(id);
      EXCEPTION
        WHEN duplicate_object THEN 
          RAISE NOTICE 'Foreign key already exists';
      END $$;
    `);
    
    console.log('Foreign key add result:', result3);
    
    // Verify the column exists
    const result = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'towers' AND column_name = 'owner_id'
    `;
    
    if (result.length > 0) {
      console.log('✓ owner_id column exists:', result[0]);
    } else {
      console.log('✗ owner_id column not found');
    }
    
    await sql.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addOwnerIdColumn();
