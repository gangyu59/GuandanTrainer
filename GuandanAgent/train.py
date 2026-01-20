import os
import time
import json
import random
import torch
import numpy as np
from typing import List, Tuple, Any
from engine.rl.env import GuandanEnv, state_to_vector
from engine.rl.mcts import MCTS
from engine.rl.model import ModelManager
from engine.cards import standard_deck
from engine.logic import get_rank_value

def self_play_game(model_manager) -> Tuple[int, List[Tuple[List[float], float]]]:
    # 1. Deal Cards
    full_deck = standard_deck() * 2
    random.shuffle(full_deck)
    # 27 cards per player
    hands = [
        full_deck[:27],
        full_deck[27:54],
        full_deck[54:81],
        full_deck[81:]
    ]
    
    # 2. Initialize God View Environment
    # Random start player
    start_player = random.randint(0, 3)
    # Random Level (2-14) to train with different wild cards
    current_level = random.randint(2, 14)
    env = GuandanEnv(my_hand=[], all_hands=hands, current_player=start_player, current_level=current_level)
    
    # 3. Game Loop
    mcts = MCTS(model=model_manager) # Pass model wrapper
    
    steps = 0
    max_steps = 200 # Safety break
    
    # Data Collection
    game_data = [] # List of (state_vector, value_target) tuples (simplification)
    
    while not env.is_done() and steps < max_steps:
        steps += 1
        current_p = env.current_player
        
        legal_moves = env.get_legal_actions()
        if not legal_moves:
            break
            
        action = None
        
        # Team 0 uses MCTS (Smart)
        if current_p in [0, 2]: # Team 0
            # Create Player View Env (PARTIAL OBSERVABILITY)
            # The AI should ONLY see its own hand and previous moves.
            # It should NOT see opponents' hands.
            # GuandanEnv(my_hand, ...) will randomly distribute other cards.
            player_view_env = GuandanEnv(
                my_hand=env.hands[current_p],
                last_play=env.last_play,
                current_player=current_p,
                pass_count=env.pass_count,
                current_level=current_level
            )
            # Use small num_simulations for speed
            mcts_action_info = mcts.search(player_view_env, num_simulations=30)
            action = mcts_action_info
            
            # Debug: Check if AI is passing too much
            # if action['type'] == 'pass' and any(m['type'] != 'pass' for m in legal_moves):
            #     print(f"AI passed! Legal moves: {len(legal_moves)}")
            
            # Collect Data
            # Store state and placeholder for winner (target)
            vec = state_to_vector(player_view_env)
            game_data.append(vec)
            
        else:
            # Simple Heuristic
            play_actions = [a for a in legal_moves if a['type'] != 'pass']
            if play_actions:
                # 80% chance to play if can
                if random.random() < 0.8:
                    action = random.choice(play_actions)
                else:
                    pass_action = next((a for a in legal_moves if a['type'] == 'pass'), None)
                    action = pass_action if pass_action else random.choice(play_actions)
            else:
                 action = legal_moves[0]
                 
        env.step(action)
        
    # 4. Determine Winner
    winner_team = -1
    for i in range(4):
        if len(env.hands[i]) == 0:
            winner_team = 0 if i in [0, 2] else 1
            break
    
    # Debug Log
    if steps >= max_steps:
        print(f"Game Terminated (Max Steps). Winner: None")
    else:
        print(f"Game Finished. Winner: Team {winner_team}. Steps: {steps}")
        
    # Return Data
    # Label data with winner: +1 if Team 0 won, -1 if Team 1 won
    # If no winner (draw/timeout), use 0 or ignore? Let's use 0.
    if winner_team == -1:
        target = 0.0
    else:
        target = 1.0 if winner_team == 0 else -1.0
        
    labeled_data = [(vec, target) for vec in game_data]
    
    return winner_team, labeled_data

class TrainingSession:
    def __init__(self):
        self.model_mgr = ModelManager()
        # Ensure directory exists
        os.makedirs("backend/data", exist_ok=True)
        self.stats_file = "backend/data/training_stats.json"
        self.games_played = 0
        self.win_rates = []
        self.win_rate_trend = [] # List of {'game': int, 'win_rate': float}
        self.replay_buffer = []
        self.buffer_size = 2000
        
        # Load stats if exist
        if os.path.exists(self.stats_file):
            try:
                with open(self.stats_file, 'r') as f:
                    data = json.load(f)
                    self.games_played = data.get('games_played', 0)
                    self.win_rates = data.get('history', [])
                    self.win_rate_trend = data.get('trend', [])
            except:
                pass

    def update_stats(self, winner_team):
        self.games_played += 1
        # Track win rate of "Model" (Team 0)
        win = 1 if winner_team == 0 else 0
        self.win_rates.append(win)
        if len(self.win_rates) > 100:
            self.win_rates.pop(0)
            
        current_win_rate = sum(self.win_rates) / len(self.win_rates) if self.win_rates else 0
        
        # Add to trend
        self.win_rate_trend.append({
            'game': self.games_played,
            'win_rate': current_win_rate
        })
        
        # Keep trend manageable? (Maybe max 1000 points)
        # For now, let's keep all, it's just two numbers per game. 
        # Even 10k games is small JSON.
        
        stats = {
            "games_played": self.games_played,
            "current_win_rate": current_win_rate,
            "model_version": f"v0.2 (MCTS-30, Trained on {self.games_played} games)",
            "history": self.win_rates,
            "trend": self.win_rate_trend
        }
        
        # Write to frontend accessible location
        try:
            with open(self.stats_file, 'w') as f:
                json.dump(stats, f)
        except Exception as e:
            print(f"Error saving stats: {e}")
            
    def train_step(self):
        if len(self.replay_buffer) < 100:
            return
            
        print(f"Training on {len(self.replay_buffer)} samples...")
        
        # Simple: Use all buffer or batch
        # For this demo, just take last 500
        batch = self.replay_buffer[-500:]
        
        states = [d[0] for d in batch]
        targets = [d[1] for d in batch]
        
        loss = self.model_mgr.train(states, targets, epochs=5)
        print(f"Loss: {loss:.4f}")
        
        # Save Model occasionally
        if self.games_played % 20 == 0:
            self.model_mgr.save_model()
            
    def run_training_loop(self):
        print("Starting Training Loop (Self-Play with Replay Buffer)...")
        while True:
            # 1. Play Game
            try:
                winner, new_data = self_play_game(self.model_mgr)
                print(f"Game {self.games_played + 1} Finished. Winner: Team {winner}")
                
                # 2. Update Stats
                self.update_stats(winner)
                
                # 3. Add to Buffer
                self.replay_buffer.extend(new_data)
                if len(self.replay_buffer) > self.buffer_size:
                    self.replay_buffer = self.replay_buffer[-self.buffer_size:]
                
                # 4. Train
                if self.games_played % 2 == 0: # Train every 2 games
                    self.train_step()
                
            except Exception as e:
                print(f"Game Error: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(1)

if __name__ == "__main__":
    session = TrainingSession()
    session.run_training_loop()
