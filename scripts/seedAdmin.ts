import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = (process.env.SEED_ADMIN_PASSWORD || '').trim();
  const adminFullName = (process.env.SEED_ADMIN_NAME || 'Administrator').trim();
  const adminPhone = (process.env.SEED_ADMIN_PHONE || '').trim() || null;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error(
      'Set SEED_ADMIN_EMAIL and a strong SEED_ADMIN_PASSWORD (at least 12 characters) in your environment.'
    );
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Enforce single-admin architecture before creating any new user
  const { data: existingAdmins, error: adminsErr } = await client
    .from('admins')
    .select('id, email, role, status');
  if (adminsErr) throw adminsErr;

  if (existingAdmins && existingAdmins.length > 0 && existingAdmins[0].email.toLowerCase() !== adminEmail) {
    throw new Error(
      `Single-admin policy violation: an admin account (${existingAdmins[0].email}) already exists.`
    );
  }

  const { data: usersPage, error: listErr } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;

  const matchedUser = (usersPage?.users ?? []).find(
    (u) => (u.email || '').toLowerCase() === adminEmail
  );

  if (!matchedUser) {
    const { data: created, error: createErr } = await client.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminFullName, name: adminFullName, role: 'Admin' },
    });
    if (createErr) throw createErr;

    const authId = created?.user?.id;
    if (!authId) throw new Error('Auth user id missing after creation');

    const { error: profileErr } = await client.from('admins').upsert({
      id: authId,
      email: adminEmail,
      name: adminFullName,
      role: 'Admin',
      status: 'Active',
      phone_number: adminPhone,
    });
    if (profileErr) throw profileErr;

    console.log('Created single auth admin user:', authId);
  } else {
    const { error: profileErr } = await client.from('admins').upsert({
      id: matchedUser.id,
      email: adminEmail,
      name: adminFullName,
      role: 'Admin',
      status: 'Active',
      phone_number: adminPhone,
    });
    if (profileErr) throw profileErr;

    console.log('Admin auth user already exists; ensured single admins row.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
