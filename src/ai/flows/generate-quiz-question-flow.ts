'use server';
/**
 * @fileOverview This file defines a Genkit flow that generates a quiz question dynamically.
 *
 * - generateQuizQuestion - A function that generates a new quiz question.
 * - GenerateQuestionInput - The input type for the generateQuizQuestion function.
 * - GenerateQuestionOutput - The return type for the generateQuizQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuestionInputSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The desired difficulty for the question.'),
  category: z.enum(['Cultura', 'Idioma', 'Sistemas Educacionais']).describe('The desired category for the question.'),
  previousQuestions: z.array(z.string()).describe('A list of previously asked questions to avoid repetition.'),
});
export type GenerateQuestionInput = z.infer<typeof GenerateQuestionInputSchema>;

const GenerateQuestionOutputSchema = z.object({
  question: z.string().describe('The question text.'),
  options: z.array(z.string()).describe('An array of 4 strings for multiple-choice, or 2 strings ("Verdadeiro", "Falso") for true/false questions.'),
  answer: z.string().describe('The correct answer. Must be one of the provided options.'),
  type: z.enum(['multiple-choice', 'true-false']).describe('The type of question.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the generated question.'),
  category: z.enum(['Cultura', 'Idioma', 'Sistemas Educacionais']).describe('The category of the generated question.'),
  explanation: z.string().describe('A brief explanation for the correct answer.'),
  imageHint: z.string().describe('A two-word, English hint for generating a relevant image (e.g., "Eiffel Tower", "Brazilian Carnival").'),
});
export type GenerateQuestionOutput = z.infer<typeof GenerateQuestionOutputSchema>;

export async function generateQuizQuestion(input: GenerateQuestionInput): Promise<GenerateQuestionOutput> {
  return generateQuizQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizQuestionPrompt',
  input: {schema: GenerateQuestionInputSchema},
  output: {schema: GenerateQuestionOutputSchema},
  prompt: `You are a creative quiz master for "GlobalMind Quiz". Your task is to generate a unique and engaging quiz question in Brazilian Portuguese based on the provided criteria.

Instructions:
1.  **Topic**: The quiz is about global cultures, languages, and educational systems.
2.  **Difficulty**: Generate a question with the difficulty level of '{{{difficulty}}}'.
3.  **Category**: Generate a question for the category '{{{category}}}'.
4.  **Type**: Decide if the question should be 'multiple-choice' (with 4 distinct options) or 'true-false' (with "Verdadeiro" and "Falso" as options).
5.  **Uniqueness**: Do NOT repeat any of these previously asked questions:
    {{#each previousQuestions}}
    - "{{this}}"
    {{/each}}
6.  **Answer**: Ensure the 'answer' field EXACTLY matches one of the strings in the 'options' array.
7.  **Image Hint**: Provide a concise, two-word, English hint for generating a relevant image. For example, for a question about the Eiffel Tower, the hint could be "Eiffel Tower". For a question about Japanese cherry blossoms, "cherry blossom".

Generate the quiz question now.`,
});


const generateQuizQuestionFlow = ai.defineFlow(
  {
    name: 'generateQuizQuestionFlow',
    inputSchema: GenerateQuestionInputSchema,
    outputSchema: GenerateQuestionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate quiz question.');
    }
    return output;
  }
);
