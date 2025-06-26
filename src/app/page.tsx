import { QuizPage } from '@/components/quiz-page';

export default function Home() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-accent/20 dark:bg-slate-900/50 backdrop-blur-sm z-0"></div>
      <QuizPage />
    </main>
  );
}
