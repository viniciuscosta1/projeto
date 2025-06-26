import { QuizPage } from '@/components/quiz-page';

export default function Home() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden bg-accent/20 dark:bg-slate-900/50">
      <QuizPage />
    </main>
  );
}
