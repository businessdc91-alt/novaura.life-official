export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // 11=J, 12=Q, 13=K

export interface Card {
  suit: Suit;
  rank: Rank;
  isFaceUp: boolean;
}

export class SolitaireFramework {
  private deck: Card[] = [];

  constructor() {
    this.initDeck();
    this.shuffle();
  }

  private initDeck() {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) {
        this.deck.push({ suit, rank: rank as Rank, isFaceUp: false });
      }
    }
  }

  shuffle() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  draw(count: number): Card[] {
    return this.deck.splice(0, count).map(c => ({ ...c, isFaceUp: true }));
  }

  getRemainingCount(): number {
    return this.deck.length;
  }

  // --- Recursive Game Logic Gates ---
  
  isValidMove(card: Card, target: Card | null): boolean {
    if (!target) return card.rank === 13; // Only Kings can move to empty tableau slots
    
    // Solitaire Rule: Opposite color and descending rank
    const isOppositeColor = this.isRed(card.suit) !== this.isRed(target.suit);
    const isDescending = card.rank === target.rank - 1;
    
    return isOppositeColor && isDescending;
  }

  private isRed(suit: Suit): boolean {
    return suit === 'hearts' || suit === 'diamonds';
  }
}

export const solitaireGame = new SolitaireFramework();
