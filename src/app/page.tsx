import { QuizPage } from '@/components/quiz-page';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export default async function Home({ searchParams }: { searchParams: { guest?: string } }) {
  const supabase = createClient();

  if (searchParams.guest === 'true') {
    const guestUser: User & { name: string } = {
        id: `guest-${new Date().getTime()}`,
        name: 'Convidado',
        email: '',
        app_metadata: { provider: 'guest' },
        user_metadata: { name: 'Convidado' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
    };
    return (
        <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-muted/30">
            <QuizPage user={guestUser} isGuest={true} />
        </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single();

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-muted/30">
      <QuizPage user={{...user, name: profile?.name || 'Player' }} />
    </main>
  );
}
