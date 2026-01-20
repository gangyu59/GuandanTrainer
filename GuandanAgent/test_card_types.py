
import unittest
from engine.logic import get_legal_moves, get_rank_value
from engine.cards import Card, Suit, Rank

class TestCardTypes(unittest.TestCase):
    def test_full_house_response(self):
        # Enemy plays 33344 (Full House 3)
        last_play = {
            "action": "play",
            "cards": [
                {"rank": "3", "suit": "H"}, {"rank": "3", "suit": "S"}, {"rank": "3", "suit": "D"},
                {"rank": "4", "suit": "H"}, {"rank": "4", "suit": "S"}
            ],
            "type": "3+2" # Explicit type
        }
        
        # My hand: 55566 (Should beat it)
        my_hand = [
            Card(Suit.HEARTS, Rank.R5), Card(Suit.SPADES, Rank.R5), Card(Suit.DIAMONDS, Rank.R5),
            Card(Suit.HEARTS, Rank.R6), Card(Suit.SPADES, Rank.R6)
        ]
        
        moves = get_legal_moves(my_hand, last_play)
        play_moves = [m for m in moves if m['action'] == 'play']
        
        self.assertTrue(len(play_moves) > 0, "Should find a move against Full House")
        self.assertEqual(play_moves[0]['type'], '3+2')
        self.assertIn("Play Full House 5", play_moves[0]['desc'])

    def test_full_house_inference(self):
        # Enemy plays 33344 (No type provided)
        last_play = {
            "action": "play",
            "cards": [
                {"rank": "3", "suit": "H"}, {"rank": "3", "suit": "S"}, {"rank": "3", "suit": "D"},
                {"rank": "4", "suit": "H"}, {"rank": "4", "suit": "S"}
            ]
            # type missing
        }
        
        # My hand: 55566
        my_hand = [
            Card(Suit.HEARTS, Rank.R5), Card(Suit.SPADES, Rank.R5), Card(Suit.DIAMONDS, Rank.R5),
            Card(Suit.HEARTS, Rank.R6), Card(Suit.SPADES, Rank.R6)
        ]
        
        moves = get_legal_moves(my_hand, last_play)
        play_moves = [m for m in moves if m['action'] == 'play']
        
        self.assertTrue(len(play_moves) > 0, "Should infer 3+2 and find a move")
        self.assertEqual(play_moves[0]['type'], '3+2')

    def test_plate_response(self):
        # Enemy plays 333444 (Plate 3-4)
        last_play = {
            "action": "play",
            "cards": [
                {"rank": "3", "suit": "H"}, {"rank": "3", "suit": "S"}, {"rank": "3", "suit": "D"},
                {"rank": "4", "suit": "H"}, {"rank": "4", "suit": "S"}, {"rank": "4", "suit": "D"}
            ],
            "type": "steel_plate"
        }
        
        # My hand: 555666 (Should beat it)
        my_hand = [
            Card(Suit.HEARTS, Rank.R5), Card(Suit.SPADES, Rank.R5), Card(Suit.DIAMONDS, Rank.R5),
            Card(Suit.HEARTS, Rank.R6), Card(Suit.SPADES, Rank.R6), Card(Suit.DIAMONDS, Rank.R6)
        ]
        
        moves = get_legal_moves(my_hand, last_play)
        play_moves = [m for m in moves if m['action'] == 'play']
        
        self.assertTrue(len(play_moves) > 0, "Should find a move against Plate")
        self.assertEqual(play_moves[0]['type'], 'steel_plate')
        self.assertIn("Play Steel Plate 5-6", play_moves[0]['desc'])

    def test_bomb_response_to_plate(self):
        # Enemy plays Plate 3-4
        last_play = {
            "action": "play",
            "cards": [
                {"rank": "3", "suit": "H"}, {"rank": "3", "suit": "S"}, {"rank": "3", "suit": "D"},
                {"rank": "4", "suit": "H"}, {"rank": "4", "suit": "S"}, {"rank": "4", "suit": "D"}
            ],
            "type": "steel_plate"
        }
        
        # My hand: 9999 (Bomb)
        my_hand = [
            Card(Suit.HEARTS, Rank.R9), Card(Suit.SPADES, Rank.R9), Card(Suit.DIAMONDS, Rank.R9), Card(Suit.CLUBS, Rank.R9)
        ]
        
        moves = get_legal_moves(my_hand, last_play)
        play_moves = [m for m in moves if m['action'] == 'play']
        
        self.assertTrue(len(play_moves) > 0, "Bomb should beat Plate")
        self.assertEqual(play_moves[0]['type'], 'bomb')

if __name__ == '__main__':
    unittest.main()
