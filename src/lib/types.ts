export interface Question {
  id: number;
  question: string;
  image?: string;
  imageHint?: string;
  options: string[];
  answer: string;
  type: 'multiple-choice' | 'true-false';
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'Cultura' | 'Idioma' | 'Sistemas Educacionais';
  explanation: string;
}

export interface PlayerScore {
  name: string;
  score: number;
  date: string;
}
