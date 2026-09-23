const fs = require('fs');
const { executeSql } = require('./run_live_sql.cjs');

async function main() {
  const sql = `
    SELECT 
      schemaname, 
      tablename, 
      policyname, 
      permissive, 
      roles, 
      cmd, 
      qual, 
      with_check 
    FROM pg_policies 
    WHERE tablename IN ('profiles', 'payments', 'member_passes', 'bookings', 'memberships', 'member_pass_credits')
    ORDER BY tablename, cmd;
  `;
  const res = await executeSql(sql);
  if (res) {
    fs.writeFileSync('scratch/policies.json', res);
    console.log('Saved to scratch/policies.json');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
