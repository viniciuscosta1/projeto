"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { BrainCircuit, CheckCircle2, XCircle, Trophy, Sparkles, Loader2, Globe, Flame, ArrowRight, LogOut, BarChart3 } from 'lucide-react';
import type { Question, PlayerScore } from '@/lib/types';
import { adaptQuizDifficulty } from '@/ai/flows/adapt-quiz-difficulty';
import { translateText } from '@/ai/flows/translate-text-flow';
import { generateQuizQuestion } from '@/ai/flows/generate-quiz-question-flow';
import { generateQuizImage } from '@/ai/flows/generate-quiz-image-flow';
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

const QUIZ_LENGTH = 10;
const quizCategories: Array<'Cultura' | 'Idioma' | 'Sistemas Educacionais'> = ['Cultura', 'Idioma', 'Sistemas Educacionais'];

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
    isGuest?: boolean;
}

export function QuizPage({ user, isGuest = false }: QuizPageProps) {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState>('welcome');
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [language, setLanguage] = useState('Brazilian Portuguese');

  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [incorrectAnswersCount, setIncorrectAnswersCount] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedTimestamp = localStorage.getItem('globalMindQuizTimestamp');
      const now = new Date().getTime();
      const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

      if (storedTimestamp && now - parseInt(storedTimestamp, 10) > TEN_MINUTES_IN_MS) {
        localStorage.removeItem('globalMindQuizLeaderboard');
        localStorage.removeItem('globalMindQuizTimestamp');
        setLeaderboard([]);
        toast({ title: 'Ranking Resetado', description: 'O ranking de pontuação foi reiniciado.' });
      } else {
        const storedScores = localStorage.getItem('globalMindQuizLeaderboard');
        if (storedScores) {
          setLeaderboard(JSON.parse(storedScores));
        }
      }
    } catch (error) {
      console.error('Failed to process leaderboard from localStorage:', error);
    }
  }, [toast]);

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
      setLanguage('Brazilian Portuguese');
    } finally {
      setIsTranslating(false);
    }
  }, [toast]);

  const getNewQuestion = useCallback(async (difficultyForNext: 'easy' | 'medium' | 'hard') => {
    setIsGenerating(true);
    setCurrentQuestion(null);
    setTranslatedQuestion(null);

    try {
      const prevQuestions = answeredQuestions.map(q => q.question);
      const randomCategory = quizCategories[Math.floor(Math.random() * quizCategories.length)];
      const questionData = await generateQuizQuestion({
        difficulty: difficultyForNext,
        category: randomCategory,
        previousQuestions: prevQuestions,
      });
      
      let imageUrl = 'https://placehold.co/600x400.png';
      if (questionData.imageHint) {
         try {
            toast({ title: "Gerando Imagem...", description: "A IA está criando uma imagem para a pergunta." });
            const result = await generateQuizImage({ imageHint: questionData.imageHint });
            imageUrl = result.imageUrl;
         } catch(e) {
            console.error("Image generation failed, using placeholder", e);
            toast({ title: "Erro na Imagem", description: "Não foi possível gerar a imagem, usando uma padrão." });
         }
      }

      const newQuestion: Question = {
        ...questionData,
        id: answeredQuestions.length + 1,
        image: imageUrl,
      };

      setCurrentQuestion(newQuestion);
      setAnsweredQuestions(prev => [...prev, newQuestion]);

      if (language !== 'Brazilian Portuguese') {
        await translateQuestion(newQuestion, language);
      }
    } catch (error) {
      console.error('Error fetching new question:', error);
      toast({
        variant: 'destructive',
        title: 'Erro de Geração',
        description: 'Não foi possível gerar uma nova pergunta. Por favor, reinicie o quiz.',
      });
      setGameState('welcome');
    } finally {
      setIsGenerating(false);
    }
  }, [answeredQuestions, language, toast, translateQuestion]);


  const handleStartQuiz = () => {
    setScore(0);
    setAnsweredQuestions([]);
    setTranslatedQuestion(null);
    setCorrectAnswersCount(0);
    setIncorrectAnswersCount(0);
    setCurrentStreak(0);
    setLongestStreak(0);
    
    getNewQuestion(difficulty);
    setGameState('playing');
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
    setIsLoadingAI(true);
    try {
      const result = await adaptQuizDifficulty({
        correctAnswersCount: correctAnswersCount,
        totalQuestions: QUIZ_LENGTH,
        questionsAnswered: answeredQuestions.length,
      });
      setDifficulty(result.difficultyLevel);
      toast({
        title: "IA Adaptativa",
        description: result.reasoning,
      });
      return result.difficultyLevel;
    } catch (error) {
      console.error('Error adapting difficulty:', error);
      return null;
    } finally {
      setIsLoadingAI(false);
    }
  }, [correctAnswersCount, answeredQuestions.length, toast]);

  const handleSaveScore = useCallback(() => {
    let playerName = user.name;
    if (isGuest) {
        const guestId = (user.id as string).slice(-4);
        playerName = `Convidado ${guestId}`;
    }

    const newScore: PlayerScore = {
      name: playerName,
      score,
      date: new Date().toISOString(),
    };

    const updatedLeaderboard = [...leaderboard, newScore]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    setLeaderboard(updatedLeaderboard);

    try {
      localStorage.setItem('globalMindQuizLeaderboard', JSON.stringify(updatedLeaderboard));
      
      const storedTimestamp = localStorage.getItem('globalMindQuizTimestamp');
      if (!storedTimestamp) {
        localStorage.setItem('globalMindQuizTimestamp', new Date().getTime().toString());
      }
    } catch (error) {
      console.error('Failed to save leaderboard to localStorage:', error);
    }
  }, [isGuest, user, score, leaderboard]);

  const handleNextQuestion = useCallback(async () => {
    if (answeredQuestions.length === QUIZ_LENGTH) {
      handleSaveScore();
      setGameState('finished');
      return;
    }

    let nextDifficulty = difficulty;
    if (answeredQuestions.length > 0 && answeredQuestions.length % 3 === 0) {
      const adapted = await adaptDifficulty();
      if (adapted) {
        nextDifficulty = adapted;
      }
    }
    
    getNewQuestion(nextDifficulty);

    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    setGameState('playing');
    setTranslatedQuestion(null);

  }, [answeredQuestions.length, difficulty, adaptDifficulty, handleSaveScore, getNewQuestion]);


  const handleSelectAnswer = (answer: string) => {
    const displayQuestion = translatedQuestion || currentQuestion;
    if (!displayQuestion || !currentQuestion) return;
    
    const correct = answer === displayQuestion.answer;
    setSelectedAnswer(answer);
    setIsAnswerCorrect(correct);
    if (correct) {
      const difficultyPoints = {
        easy: 10,
        medium: 15,
        hard: 20,
      };
      const pointsGained = difficultyPoints[currentQuestion.difficulty] || 10;
      setScore(prev => prev + pointsGained);
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
            <CardDescription className="text-md">
                {isGuest ? 'Bem-vindo(a) ao modo convidado!' : `Olá, ${user.name}! Bem-vindo(a) de volta.`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-center text-muted-foreground">
          Teste seus conhecimentos sobre o mundo em um quiz dinâmico e com imagens geradas por IA. Preparado para o desafio?
        </p>
        <Leaderboard scores={leaderboard} />
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <div className="w-full flex flex-col sm:flex-row items-start justify-center gap-4">
           <div className="flex flex-col items-center gap-2">
            <Label htmlFor="language-select" className="text-sm text-muted-foreground">Idioma do Quiz</Label>
            <Select onValueChange={setLanguage} defaultValue={language}>
                <SelectTrigger id="language-select" className="w-[240px]">
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
           <div className="flex flex-col items-center gap-2">
            <Label htmlFor="difficulty-select" className="text-sm text-muted-foreground">Dificuldade Inicial</Label>
            <Select onValueChange={(value) => setDifficulty(value as 'easy' | 'medium' | 'hard')} defaultValue={difficulty}>
                <SelectTrigger id="difficulty-select" className="w-[240px]">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Selecione a Dificuldade" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="hard">Difícil</SelectItem>
                </SelectContent>
            </Select>
           </div>
        </div>
        <Button onClick={handleStartQuiz} className="w-full mt-4" size="lg">
          Começar o Quiz!
        </Button>
         {isGuest ? (
            <Button variant="link" onClick={() => router.push('/login')} className="text-muted-foreground">
                Sair do modo Convidado
                <LogOut className="ml-2 h-4 w-4" />
            </Button>
         ) : (
            <Button variant="link" onClick={handleLogout} className="text-muted-foreground">
                Sair
                <LogOut className="ml-2 h-4 w-4" />
            </Button>
         )}
      </CardFooter>
    </Card>
  );

  const renderQuiz = () => {
    const displayQuestion = translatedQuestion || currentQuestion;
    
    if (isGenerating || !displayQuestion) {
      return (
        <Card className="w-full max-w-2xl">
          <CardContent className="p-10 text-center flex flex-col items-center justify-center h-96">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="mt-4 text-lg font-semibold">Gerando um novo desafio para você...</p>
            <p className="text-muted-foreground">Isso pode levar alguns segundos.</p>
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
        {(isTranslating) && (
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10 rounded-lg">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <div className="flex justify-between items-start mb-2 gap-4">
             <Progress value={(questionIndex / QUIZ_LENGTH) * 100} className="mt-2 w-full" />
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
            <span>Pergunta {questionIndex + 1} de {QUIZ_LENGTH}</span>
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
                {answeredQuestions.length === QUIZ_LENGTH ? 'Ver Resultados' : 'Próxima Pergunta'}
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
        <CardDescription>Parabéns, {isGuest ? 'Convidado' : user.name}, por completar o desafio!</CardDescription>
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
        {isGuest ? (
            <Button variant="link" onClick={() => router.push('/login')} className="text-muted-foreground">
                Sair do modo Convidado
                <LogOut className="ml-2 h-4 w-4" />
            </Button>
        ) : (
            <Button variant="link" onClick={handleLogout} className="text-muted-foreground">
                Sair
                <LogOut className="ml-2 h-4 w-4" />
            </Button>
        )}
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
