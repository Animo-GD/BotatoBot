import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    // Sanitize username into a valid email prefix
    const safeUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!safeUsername) {
      return NextResponse.json({ error: 'Username must contain at least one letter or number.' }, { status: 400 });
    }

    const email = `${safeUsername}@batatabotato.com`;

    // Use admin client — creates user with NO email confirmation
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Mark as confirmed immediately
      user_metadata: { username },
    });

    if (error) {
      // User already exists
      if (error.message.includes('already been registered')) {
        return NextResponse.json({ error: 'This User Name is already taken.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
    }

    // Create profile row in batata schema
    const { error: profileError } = await supabaseAdmin
      .schema('batata')
      .from('profiles')
      .insert({ id: data.user.id, username });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Cleanup the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: `Failed to create profile: ${profileError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
