import sys
import os

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import time
import json
import random
import torch
import numpy as np
import argparse
from typing import List, Tuple, Any
from GuandanAgent.engine.rl.env import GuandanEnv, state_to_vector
from GuandanAgent.engine.rl.mcts import MCTS
from GuandanAgent.engine.rl.model import ModelManager
from GuandanAgent.engine.cards import standard_deck
from GuandanAgent.engine.logic import get_rank_value

def self_play_game(model_manager, opponent_type='mcts') -> Tuple[int, List[Tuple[List[float], float]]]:
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
    # Agent Config:
    # Team 0 (Player 0, 2): MCTS with Model (The "Learner")
    # Team 1 (Player 1, 3): Opponent (Heuristic or MCTS)
    
    learner_mcts = MCTS(model=model_manager)
    
    if opponent_type == 'heuristic':
        # Pure Heuristic (No MCTS Search, just policy)
        opponent_mcts = MCTS(model=None) 
    else: # mcts or self_play
        # Opponent uses MCTS too
        # If 'self_play', it shares the same model? 
        # Yes, AlphaGo Zero self-play uses same model for both sides.
        opponent_mcts = MCTS(model=model_manager)

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
        
        # Create Player View Env (PARTIAL OBSERVABILITY)
        player_view_env = GuandanEnv(
            my_hand=env.hands[current_p],
            last_play=env.last_play,
            current_player=current_p,
            pass_count=env.pass_count,
            current_level=current_level
        )

        # Select Agent based on Team
        if current_p in [0, 2]: # Team 0 (Learner)
            sims = 50 
            mcts_action_info = learner_mcts.search(player_view_env, num_simulations=sims)
            action = mcts_action_info
            
            # Collect Data only for Learner?
            # AlphaGo collects for ALL moves in self-play.
            # But if opponent is Heuristic, maybe we shouldn't learn from Heuristic's moves?
            # Actually, we learn from the *Outcome* of the state.
            # If Heuristic made a move, and Lost, we learn that state was Bad.
            # So yes, collect all data.
            vec = state_to_vector(player_view_env)
            game_data.append((current_p, vec))
            
        else: # Team 1 (Opponent)
            if opponent_type == 'heuristic':
                # Direct Heuristic Policy (Fast, no Search)
                # We need access to _heuristic_policy. 
                # MCTS class has it.
                lm = player_view_env.get_legal_actions()
                # Mock state object required by _heuristic_policy
                # Or just use MCTS with 1 simulation? 
                # MCTS with 0 simulations runs rollout policy (heuristic).
                # But search() forces at least 1.
                # Let's call _heuristic_policy directly.
                class MockState:
                    def __init__(self, lp, cl, cp, lpi):
                        self.last_play = lp
                        self.current_level = cl
                        self.current_player = cp
                        self.last_player_idx = lpi
                
                s = MockState(player_view_env.last_play, player_view_env.current_level, player_view_env.current_player, player_view_env.last_player_idx)
                action = opponent_mcts._heuristic_policy(lm, s)
                
                # We also collect data for Heuristic moves?
                # If we want to learn "Heuristic moves lead to Loss/Win", yes.
                vec = state_to_vector(player_view_env)
                game_data.append((current_p, vec))
                
            else:
                # MCTS Opponent
                sims = 50
                mcts_action_info = opponent_mcts.search(player_view_env, num_simulations=sims)
                action = mcts_action_info
                
                vec = state_to_vector(player_view_env)
                game_data.append((current_p, vec))
                 
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
        # print(f"Game Finished. Winner: Team {winner_team}. Steps: {steps}")
        pass
        
    # Return Data
    if winner_team == -1:
        labeled_data = [] # Discard draws/incomplete
    else:
        labeled_data = []
        for p, vec in game_data:
            player_team = 0 if p in [0, 2] else 1
            if player_team == winner_team:
                reward = 1.0
            else:
                reward = -1.0
            labeled_data.append((vec, reward))
    
    return winner_team, labeled_data

class TrainingSession:
    def __init__(self):
        self.model_mgr = ModelManager()
        # Ensure directory exists
        base_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.join(base_dir, "backend", "data")
        os.makedirs(data_dir, exist_ok=True)
        self.stats_file = os.path.join(data_dir, "training_stats.json")
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
            "model_version": f"v0.3 (MCTS Fixed, Trained on {self.games_played} games)",
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
            
    def run_training_loop(self, num_games=None, opponent_type='mcts'):
        print(f"Starting Training Loop (Mode: vs {opponent_type})...")
        
        target_games = None
        if num_games:
            target_games = self.games_played + num_games
            print(f"Target: Play {num_games} new games (Stop at {target_games})")
            
        while True:
            # Check exit condition
            if target_games is not None and self.games_played >= target_games:
                print(f"Completed {num_games} new games. Stopping.")
                break
                
            # 1. Play Game
            try:
                winner, new_data = self_play_game(self.model_mgr, opponent_type=opponent_type)
                print(f"Game {self.games_played + 1} Finished. Winner: Team {winner}")
                
                # 2. Update Stats
                self.update_stats(winner)
                
                # 3. Add to Buffer
                if new_data:
                    self.replay_buffer.extend(new_data)
                    if len(self.replay_buffer) > self.buffer_size:
                        self.replay_buffer = self.replay_buffer[-self.buffer_size:]
                
                # 4. Train
                # Train every 1 game if we have enough data
                if len(self.replay_buffer) >= 100:
                    self.train_step()
                
            except Exception as e:
                print(f"Game Error: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Guandan RL Training')
    parser.add_argument('--games', type=int, default=None, help='Number of games to play (default: infinite)')
    parser.add_argument('--opponent', type=str, default='mcts', choices=['heuristic', 'mcts'], help='Opponent type: heuristic or mcts (default: mcts)')
    args = parser.parse_args()
    
    session = TrainingSession()
    session.run_training_loop(num_games=args.games, opponent_type=args.opponent)
