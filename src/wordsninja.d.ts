declare module 'wordsninja' {
  export default class WordsNinja {
    constructor();
    loadDictionary(): Promise<void>;
    splitSentence(text: string): string[];
    addWords(words: string[]): void;
  }
}
