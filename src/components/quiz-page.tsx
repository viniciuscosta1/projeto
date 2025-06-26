"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { BrainCircuit, CheckCircle2, XCircle, Trophy, Sparkles, Loader2 } from 'lucide-react';
import type { Question, PlayerScore } from '@/lib/types';
import { initialQuestions } from '@/lib/questions';
import { adaptQuizDifficulty } from '@/ai/flows/adapt-quiz-difficulty';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Leaderboard } from './leaderboard';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

type GameState = 'welcome' | 'playing' | 'feedback' | 'finished';

export function QuizPage() {
  const [gameState, setGameState] = useState<GameState>('welcome');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Question[]>([]);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerScore[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [isLoadingAI, setIsLoadingAI] = useState(false);

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

  const handleStartQuiz = () => {
    setScore(0);
    setAnsweredQuestions([]);
    const answeredIds = [];
    const firstQuestion = pickQuestion('easy', answeredIds);
    setCurrentQuestion(firstQuestion);
    setAnsweredQuestions(firstQuestion ? [firstQuestion] : []);
    setGameState('playing');
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

  }, [answeredQuestions, difficulty, pickQuestion, adaptDifficulty]);


  const handleSelectAnswer = (answer: string) => {
    if (!currentQuestion) return;
    
    const correct = answer === currentQuestion.answer;
    setSelectedAnswer(answer);
    setIsAnswerCorrect(correct);
    if (correct) {
      setScore(prev => prev + 10);
    }
    setGameState('feedback');

    setTimeout(() => {
      handleNextQuestion();
    }, 3000);
  };

  const handleSaveScore = () => {
    if (!playerName.trim()) {
      toast({
        title: "Nome inválido",
        description: "Por favor, insira um nome.",
        variant: "destructive",
      });
      return;
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
    } catch (error) {
      console.error('Failed to save leaderboard to localStorage:', error);
    }
    setPlayerName('');
  };
  
  const questionIndex = useMemo(() => answeredQuestions.length -1, [answeredQuestions]);

  const renderWelcome = () => (
    <Card className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center gap-4 mb-4">
          <BrainCircuit className="w-12 h-12 text-primary" />
          <div>
            <CardTitle className="text-3xl font-bold font-headline">GlobalMind Quiz</CardTitle>
            <CardDescription className="text-md">Conectando Culturas, Idiomas e Saberes Globais</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-center text-muted-foreground">
          Teste seus conhecimentos sobre o mundo em um quiz divertido e educativo. Preparado para o desafio?
        </p>
        <Leaderboard scores={leaderboard} />
      </CardContent>
      <CardFooter>
        <Button onClick={handleStartQuiz} className="w-full" size="lg">
          Começar o Quiz!
        </Button>
      </CardFooter>
    </Card>
  );

  const renderQuiz = () => {
    if (!currentQuestion) {
      return (
        <Card>
          <CardContent className="p-10 text-center">
            <p>Carregando pergunta...</p>
          </CardContent>
        </Card>
      );
    }
    
    const getButtonClass = (option: string) => {
      if (gameState !== 'feedback') {
        return 'justify-start text-left h-auto';
      }
      if (option === currentQuestion.answer) {
        return 'justify-start text-left h-auto bg-green-100 border-green-500 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300';
      }
      if (option === selectedAnswer) {
        return 'justify-start text-left h-auto bg-red-100 border-red-500 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300';
      }
      return 'justify-start text-left h-auto';
    };

    return (
      <Card key={questionIndex} className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95">
        <CardHeader>
          <Progress value={(questionIndex / initialQuestions.length) * 100} className="mb-2" />
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Pergunta {questionIndex + 1} de {initialQuestions.length}</span>
            <div className="flex items-center gap-2 font-bold text-primary">
              <Trophy className="w-4 h-4" />
              <span>Pontos: {score}</span>
            </div>
          </div>
          <CardTitle className="pt-4 text-2xl font-headline">{currentQuestion.question}</CardTitle>
           <Badge variant="outline" className="w-fit">{currentQuestion.category}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentQuestion.image && (
            <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden">
               <Image
                src={currentQuestion.image}
                alt={currentQuestion.question}
                layout="fill"
                objectFit="cover"
                data-ai-hint={currentQuestion.imageHint}
              />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentQuestion.options.map((option, index) => (
              <Button
                key={index}
                variant="outline"
                className={getButtonClass(option)}
                onClick={() => handleSelectAnswer(option)}
                disabled={gameState === 'feedback'}
              >
                <span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>
                <span className="whitespace-normal">{option}</span>
              </Button>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          {gameState === 'feedback' && (
             <Alert variant={isAnswerCorrect ? "default" : "destructive"} className="w-full animate-in fade-in-0">
               <div className="flex items-center gap-2">
                {isAnswerCorrect ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                <AlertTitle>{isAnswerCorrect ? 'Correto!' : 'Incorreto!'}</AlertTitle>
               </div>
              <AlertDescription className="pl-7 pt-1">
                {currentQuestion.explanation}
              </AlertDescription>
            </Alert>
          )}
           {isLoadingAI && <Loader2 className="w-4 h-4 animate-spin" />}
        </CardFooter>
      </Card>
    );
  };

  const renderFinished = () => (
    <Card className="w-full max-w-2xl animate-in fade-in-0 zoom-in-95">
      <CardHeader className="text-center">
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
        <CardTitle className="text-3xl font-bold font-headline">Quiz Finalizado!</CardTitle>
        <CardDescription>Parabéns por completar o desafio!</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-2xl">Sua pontuação final é:</p>
        <p className="text-6xl font-bold text-primary">{score}</p>
        <div className="flex items-center justify-center gap-2 pt-4">
          <Input 
            type="text" 
            placeholder="Digite seu nome para o ranking" 
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleSaveScore} disabled={!playerName.trim()}>Salvar Pontuação</Button>
        </div>
        <div className="pt-4">
          <Leaderboard scores={leaderboard} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleStartQuiz} className="w-full" size="lg">
          <Sparkles className="mr-2 h-4 w-4"/>
          Jogar Novamente
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
