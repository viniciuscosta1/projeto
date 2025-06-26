import { QuizPage } from '@/components/quiz-page';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = createClient();

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
