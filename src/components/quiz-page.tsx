"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { BrainCircuit, CheckCircle2, XCircle, Trophy, Sparkles, Loader2, Globe, Flame, ArrowRight, LogOut } from 'lucide-react';
import type { Question, PlayerScore } from '@/lib/types';
import { initialQuestions } from '@/lib/questions';
import { adaptQuizDifficulty } from '@/ai/flows/adapt-quiz-difficulty';
import { translateText } from '@/ai/flows/translate-text-flow';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Leaderboard } from './leaderboard';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type GameState = 'welcome' | 'playing' | 'feedback' | 'finished';

const supportedLanguages = [
  { value: 'Brazilian Portuguese', label: 'Português (Brasil)' },
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Español' },
  { value: 'French', label: 'Français' },
  { value: 'German', label: 'Deutsch' },
  { value: 'Mandarin Chinese', label: '中文 (简体)' },
];

interface QuizPageProps {
    user: User & { name: string };
}

export function QuizPage({ user }: QuizPageProps) {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>('welcome');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [translatedQuestion, setTranslatedQuestion] = useState<Question | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Question[]>([]);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerScore[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [language, setLanguage] = useState('Brazilian Portuguese');

  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [incorrectAnswersCount, setIncorrectAnswersCount] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedScores = localStorage.getItem('globalMindQuizLeaderboard');
      if (storedScores) {
        setLeaderboard(JSON.parse(storedScores));
      }
    } catch (error) {
      console.error('Failed to load leaderboard from localStorage:', error);
    }
  }, []);

  const pickQuestion = useCallback((currentDifficulty: 'easy' | 'medium' | 'hard', answeredIds: number[]) => {
    const availableQuestions = initialQuestions.filter(q => !answeredIds.includes(q.id));
    if (availableQuestions.length === 0) return null;

    let pool = availableQuestions.filter(q => q.difficulty === currentDifficulty);
    if (pool.length === 0) {
      pool = availableQuestions; // Fallback to any available question
    }
    
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);
  
  const translateQuestion = useCallback(async (questionToTranslate: Question, targetLanguage: string) => {
    if (targetLanguage === 'Brazilian Portuguese') {
      setTranslatedQuestion(null);
      return;
    }
    if (!questionToTranslate) return;

    setIsTranslating(true);
    
    try {
      const textsToTranslate = [
        questionToTranslate.question,
        ...questionToTranslate.options,
        questionToTranslate.explanation,
        questionToTranslate.answer,
      ];

      const translationPromises = textsToTranslate.map(text => 
        translateText({ text, targetLanguage })
      );
      
      const translatedResults = await Promise.all(translationPromises);
      const translatedTexts = translatedResults.map(r => r.translatedText);
      
      const [question, ...rest] = translatedTexts;
      const options = rest.slice(0, questionToTranslate.options.length);
      const explanation = rest[questionToTranslate.options.length];
      const answer = rest[questionToTranslate.options.length + 1];

      setTranslatedQuestion({
        ...questionToTranslate,
        question,
        options,
        explanation,
        answer,
      });
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na tradução',
        description: 'Não foi possível traduzir o quiz. Tente novamente.',
      });
      setLanguage('Brazilian Portuguese'); // Revert on error
    } finally {
      setIsTranslating(false);
    }
  }, [toast]);


  const handleStartQuiz = () => {
    setScore(0);
    setAnsweredQuestions([]);
    setTranslatedQuestion(null);
    setCorrectAnswersCount(0);
    setIncorrectAnswersCount(0);
    setCurrentStreak(0);
    setLongestStreak(0);
    const answeredIds = [];
    const firstQuestion = pickQuestion('easy', answeredIds);
    setCurrentQuestion(firstQuestion);
    setAnsweredQuestions(firstQuestion ? [firstQuestion] : []);
    setGameState('playing');

    if (language !== 'Brazilian Portuguese' && firstQuestion) {
      translateQuestion(firstQuestion, language);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (gameState === 'playing' && currentQuestion) {
      toast({
        title: "Traduzindo...",
        description: `Alterando idioma para ${supportedLanguages.find(l => l.value === newLanguage)?.label}.`,
      });
      translateQuestion(currentQuestion, newLanguage);
    }
  };

  const adaptDifficulty = useCallback(async () => {
    if (!currentQuestion) return;
    setIsLoadingAI(true);
    toast({
      title: "IA Adaptativa",
      description: "Ajustando a dificuldade da próxima pergunta...",
    });
    try {
      const result = await adaptQuizDifficulty({
        userScore: score,
        totalQuestions: initialQuestions.length,
        questionsAnswered: answeredQuestions.length,
      });
      setDifficulty(result.difficultyLevel);
    } catch (error) {
      console.error('Error adapting difficulty:', error);
    } finally {
      setIsLoadingAI(false);
    }
  }, [score, answeredQuestions.length, currentQuestion, toast]);

  const handleNextQuestion = useCallback(() => {
    if (answeredQuestions.length === initialQuestions.length) {
      handleSaveScore(); // Auto-save score at the end
      setGameState('finished');
      return;
    }

    if (answeredQuestions.length % 4 === 0 && answeredQuestions.length > 0) {
      adaptDifficulty();
    }
    
    const answeredIds = answeredQuestions.map(q => q.id);
    const nextQuestion = pickQuestion(difficulty, answeredIds);
    
    setCurrentQuestion(nextQuestion);
    if(nextQuestion){
      setAnsweredQuestions(prev => [...prev, nextQuestion]);
    }

    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    setGameState('playing');
    setTranslatedQuestion(null);

    if (nextQuestion) {
        if (language !== 'Brazilian Portuguese') {
            translateQuestion(nextQuestion, language);
        }
    }

  }, [answeredQuestions, difficulty, pickQuestion, adaptDifficulty, language, translateQuestion]);


  const handleSelectAnswer = (answer: string) => {
    const displayQuestion = translatedQuestion || currentQuestion;
    if (!displayQuestion) return;
    
    const correct = answer === displayQuestion.answer;
    setSelectedAnswer(answer);
    setIsAnswerCorrect(correct);
    if (correct) {
      setScore(prev => prev + 10);
      setCorrectAnswersCount(prev => prev + 1);
      setCurrentStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > longestStreak) {
          setLongestStreak(newStreak);
        }
        return newStreak;
      });
    } else {
      setIncorrectAnswersCount(prev => prev + 1);
      setCurrentStreak(0);
    }
    setGameState('feedback');
  };

  const handleSaveScore = () => {
    const newScore: PlayerScore = {
      name: user.name,
      score,
      date: new Date().toISOString(),
    };
    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    setLeaderboard(updatedLeaderboard);
    try {
      localStorage.setItem('globalMindQuizLeaderboard', JSON.stringify(updatedLeaderboard));
    } catch (error) {
      console.error('Failed to save leaderboard to localStorage:', error);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
  
  const questionIndex = useMemo(() => answeredQuestions.length -1, [answeredQuestions]);

  const renderWelcome = () => (
    <Card className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center gap-4 mb-4">
          <BrainCircuit className="w-12 h-12 text-primary" />
          <div>
            <CardTitle className="text-3xl font-bold">GlobalMind Quiz</CardTitle>
            <CardDescription className="text-md">Olá, {user.name}! Bem-vindo(a) de volta.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-center text-muted-foreground">
          Teste seus conhecimentos sobre o mundo em um quiz divertido e educativo. Preparado para o desafio?
        </p>
        <Leaderboard scores={leaderboard} />
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <div className="w-full flex flex-col items-center gap-2">
           <Label className="text-sm text-muted-foreground">Selecione um idioma para o quiz</Label>
           <Select onValueChange={setLanguage} defaultValue={language}>
              <SelectTrigger className="w-[240px]">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Selecione o Idioma" />
              </SelectTrigger>
              <SelectContent>
                  {supportedLanguages.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
        <Button onClick={handleStartQuiz} className="w-full mt-4" size="lg">
          Começar o Quiz!
        </Button>
         <Button variant="link" onClick={handleLogout} className="text-muted-foreground">
            Sair
            <LogOut className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );

  const renderQuiz = () => {
    const displayQuestion = translatedQuestion || currentQuestion;
    
    if (!displayQuestion) {
      return (
        <Card className="w-full max-w-2xl">
          <CardContent className="p-10 text-center flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="ml-4">Carregando pergunta...</p>
          </CardContent>
        </Card>
      );
    }
    
    const getButtonClass = (option: string) => {
      const baseClasses = 'justify-start text-left h-auto whitespace-normal py-3';
      if (gameState !== 'feedback') {
        return baseClasses;
      }
      if (option === displayQuestion.answer) {
        return `${baseClasses} border-2 border-green-500 bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-200 dark:border-green-600`;
      }
      if (option === selectedAnswer) {
        return `${baseClasses} border-2 border-red-500 bg-red-50 text-red-900 dark:bg-red-900/30 dark:text-red-200 dark:border-red-600`;
      }
      return `${baseClasses} opacity-50 cursor-not-allowed`;
    };

    return (
      <Card key={questionIndex} className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95 relative">
        {isTranslating && (
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <div className="flex justify-between items-start mb-2 gap-4">
             <Progress value={(questionIndex / initialQuestions.length) * 100} className="mt-2 w-full" />
             <Select disabled={isTranslating || gameState === 'feedback'} onValueChange={handleLanguageChange} value={language}>
              <SelectTrigger className="w-[220px]">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                  {supportedLanguages.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Pergunta {questionIndex + 1} de {initialQuestions.length}</span>
            <div className="flex items-center gap-2 font-bold text-primary">
              <Trophy className="w-4 h-4" />
              <span>Pontos: {score}</span>
            </div>
          </div>
           <div className="flex justify-around items-center py-2 border-t border-b mt-4 mb-2">
                <div className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{correctAnswersCount} Acertos</span>
                </div>
                <div className="flex items-center gap-1 text-red-600 font-medium">
                    <XCircle className="w-5 h-5" />
                    <span>{incorrectAnswersCount} Erros</span>
                </div>
                <div className="flex items-center gap-1 text-orange-500 font-medium">
                    <Flame className="w-5 h-5" />
                    <span>Sequência: {currentStreak}</span>
                </div>
           </div>
          <CardTitle className="pt-2 text-2xl">{displayQuestion.question}</CardTitle>
           <Badge variant="outline" className="w-fit">{displayQuestion.category}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {displayQuestion.image && (
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden">
               <Image
                src={displayQuestion.image}
                alt={displayQuestion.question}
                layout="fill"
                objectFit="cover"
                data-ai-hint={displayQuestion.imageHint}
              />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayQuestion.options.map((option, index) => (
              <Button
                key={index}
                variant="outline"
                className={getButtonClass(option)}
                onClick={() => handleSelectAnswer(option)}
                disabled={gameState === 'feedback' || isTranslating}
              >
                <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                <span className="whitespace-normal">{option}</span>
              </Button>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4">
          {gameState === 'feedback' && (
            <>
              <Alert variant={isAnswerCorrect ? "success" : "destructive"} className="w-full animate-in fade-in-0">
                  {isAnswerCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertTitle className="font-bold">{isAnswerCorrect ? 'Correto!' : 'Incorreto!'}</AlertTitle>
                  <AlertDescription>
                    {displayQuestion.explanation}
                  </AlertDescription>
              </Alert>
              <Button onClick={handleNextQuestion} className="w-full" size="lg">
                {answeredQuestions.length === initialQuestions.length ? 'Ver Resultados' : 'Próxima Pergunta'}
                <ArrowRight />
              </Button>
            </>
          )}
           {isLoadingAI && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>A IA está ajustando a dificuldade...</span>
            </div>
           )}
        </CardFooter>
      </Card>
    );
  };

  const renderFinished = () => (
    <Card className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95">
      <CardHeader className="text-center">
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
        <CardTitle className="text-3xl font-bold">Quiz Finalizado!</CardTitle>
        <CardDescription>Parabéns, {user.name}, por completar o desafio!</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-2xl">Sua pontuação final é:</p>
        <p className="text-6xl font-bold text-primary">{score}</p>
        
        <div className="grid grid-cols-3 gap-4 text-center py-4 border-t border-b my-4">
            <div>
                <p className="text-sm text-muted-foreground">Acertos</p>
                <p className="text-2xl font-bold text-green-600">{correctAnswersCount}</p>
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold text-red-600">{incorrectAnswersCount}</p>
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Melhor Sequência</p>
                <p className="text-2xl font-bold text-orange-500">{longestStreak}</p>
            </div>
        </div>

        <div className="pt-4">
          <Leaderboard scores={leaderboard} />
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button onClick={handleStartQuiz} className="w-full" size="lg">
          <Sparkles className="mr-2 h-4 w-4"/>
          Jogar Novamente
        </Button>
         <Button variant="link" onClick={handleLogout} className="text-muted-foreground">
            Sair
            <LogOut className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );

  switch (gameState) {
    case 'playing':
    case 'feedback':
      return renderQuiz();
    case 'finished':
      return renderFinished();
    case 'welcome':
    default:
      return renderWelcome();
  }
}
