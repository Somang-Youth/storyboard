export interface ScriptureBook {
  name: string;
  abbreviation: string;
  bskoreaCode: string;
  order: number;
}

export interface ScripturePoint {
  chapter: number;
  verse: number;
}

export interface ScriptureReference {
  book: ScriptureBook;
  start: ScripturePoint;
  end: ScripturePoint;
}

export interface ScriptureVerse {
  book: ScriptureBook;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  text: string;
}

export interface ScriptureSlidePage {
  title: string;
  text: string;
  verseStart: string;
  verseEnd: string;
}
