import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env if .env.local doesn't exist
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY env vars. '
      + 'Set them before running this script.',
    );
  }

  // NOTE: this script requires a Supabase *service role* key if RLS blocks inserts.
  // Prefer setting SUPABASE_SERVICE_ROLE_KEY and using it below.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const client = createClient(
    supabaseUrl,
    serviceRoleKey ?? supabaseKey,
  );

  const adminEmail = 'santoskyleerica@gmail.com';
  const adminPassword = 'admin123';
  const adminFullName = 'Kyle Erica Santos';

  // Create auth user if it doesn't exist.
  // Supabase Admin API is only available with service role.
  if (!serviceRoleKey) {
    console.log(
      'No SUPABASE_SERVICE_ROLE_KEY provided. '
      + 'Cannot reliably create Auth user in this script due to security/RLS constraints.',
    );
    console.log('Please create the Auth user manually in Supabase, then ensure a profiles row exists.');
    return;
  }

  const { data: existingUsers, error: listErr } = await (client.auth.admin as any).listUsers({
    email: adminEmail,
  });
  if (listErr) {
    throw listErr;
  }

  if (!existingUsers?.length) {
    const { data: created, error: createErr } = await client.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminFullName },
    });

    if (createErr) throw createErr;

    console.log('Created auth admin user:', created?.user?.id);

    const authId = created?.user?.id;
    if (!authId) throw new Error('Auth user id missing after creation');

    // Upsert profile row.
    const { error: profileErr } = await client
      .from('profiles')
      .upsert({
        id: authId,
        email: adminEmail,
        name: adminFullName,
        role: 'Admin',
        status: 'Active',
        phone_number: 9467158519,
      });

    if (profileErr) throw profileErr;

    console.log('Upserted profiles row.');
  } else {
    const authId = existingUsers[0].id;
    const { error: profileErr } = await client
      .from('profiles')
      .upsert({
        id: authId,
        email: adminEmail,
        name: adminFullName,
        role: 'Admin',
        status: 'Active',
      });

    if (profileErr) throw profileErr;

    console.log('Admin auth user already exists; ensured profiles row.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
