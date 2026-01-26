
import math
import time
import random
from typing import Dict, List, Any
from .env import GuandanEnv
from GuandanAgent.engine.logic import POWER_RANK, get_rank_value, get_rank_from_card

class MCTSNode:
    def __init__(self, state: GuandanEnv, parent=None, action=None):
        self.state = state
        self.parent = parent
        self.action = action # Action taken to reach this state
        self.children: Dict[str, MCTSNode] = {}
        self.visits = 0
        self.value = 0.0 # Accumulated score for Player 0 (Team 0/2)
        self.untried_actions = state.get_legal_actions()

    def is_fully_expanded(self):
        return len(self.untried_actions) == 0

    def best_child(self, c_param=1.414):
        # Determine who is making the choice at this node
        player = self.state.current_player
        is_team_0 = player in [0, 2]
        
        best_score = -float('inf')
        best_nodes = []
        
        for child in self.children.values():
            if child.visits == 0:
                continue
                
            # Average score from Player 0's perspective
            avg_val = child.value / child.visits
            
            # If it's Team 1's turn, they want to MINIMIZE P0's score (which is Maximizing their own)
            # Standard UCT is for Maximization.
            # So if Team 1, we invert the value: (1 - avg_val) or just -avg_val
            # Our reward is +1 (P0 Win) or -1 (P1 Win).
            # So if Team 1 moving, they want -1. So "Goodness" for them is -avg_val.
            
            exploit = avg_val if is_team_0 else -avg_val
            explore = c_param * math.sqrt((2 * math.log(self.visits) / child.visits))
            
            score = exploit + explore
            
            if score > best_score:
                best_score = score
                best_nodes = [child]
            elif score == best_score:
                best_nodes.append(child)
                
        if not best_nodes:
            return list(self.children.values())[0]
            
        return random.choice(best_nodes)

class MCTS:
    def __init__(self, time_limit_ms=2000, model=None):
        self.time_limit_ms = time_limit_ms
        self.model = model # Value Network (optional)

    def search(self, root_state: GuandanEnv, num_simulations: int = None) -> Dict[str, Any]:
        root_node = MCTSNode(root_state.clone())
        
        # Filter "Stupid Bombs" at Root (Pruning)
        # If target is NOT a Bomb, and we have non-Bomb responses, REMOVE Bombs from consideration.
        if root_state.last_play and root_state.last_play.get("type") not in ["bomb", "straight_flush"]:
             # Check if we have valid non-bomb plays
             non_bomb_actions = [a for a in root_node.untried_actions if a['type'] not in ["bomb", "straight_flush", "pass"]]
             
             if non_bomb_actions:
                 # We have a valid non-bomb play (e.g. Single 7 vs Single 6).
                 # Prune all Bomb/SF actions to enforce "Don't Overkill".
                 root_node.untried_actions = [
                     a for a in root_node.untried_actions 
                     if a['type'] not in ["bomb", "straight_flush"]
                 ]
                 print(f"MCTS Pruning: Removed Bombs because valid non-bomb moves exist.")

        start_time = time.time()
        
        iterations = 0
        while True:
            # Check stopping criteria
            if num_simulations is not None:
                if iterations >= num_simulations:
                    break
            elif time.time() - start_time > (self.time_limit_ms / 1000.0):
                 break

            node = root_node
            
            # Select
            while not node.state.is_done() and node.is_fully_expanded() and node.children:
                node = node.best_child()
                
            # Expand
            if not node.state.is_done() and not node.is_fully_expanded():
                node = self.expand(node)
                
            # Rollout
            result = self.rollout(node.state)
            
            # Backpropagate
            self.backpropagate(node, result)
            
            iterations += 1
            
        print(f"MCTS Iterations: {iterations}")
        
        if not root_node.children:
            # Fallback if no search done
            legal = root_state.get_legal_actions()
            return legal[0] if legal else None
            
        # DEBUG: Print Root Children Stats
        for child in root_node.children.values():
            avg_val = child.value / child.visits if child.visits > 0 else 0
            is_team_0 = root_state.current_player in [0, 2]
            win_rate = (avg_val + 1) / 2 if is_team_0 else (-avg_val + 1) / 2
            print(f"DEBUG: Root Action: {child.action['desc']} | Visits: {child.visits} | Value: {child.value:.2f} | WR: {win_rate:.2f}")

        # Select best action (robust child: most visits)
        # Apply "Play Bias": If Pass is best, but a Play action is close in quality, prefer Play.
        
        children = list(root_node.children.values())
        # Calculate WR for all
        for c in children:
            avg = c.value / c.visits if c.visits > 0 else 0
            is_team_0 = root_state.current_player in [0, 2]
            c.win_rate = (avg + 1) / 2 if is_team_0 else (-avg + 1) / 2
            
        # Sort by Visits (Primary) then Win Rate (Secondary)
        children.sort(key=lambda c: (c.visits, c.win_rate), reverse=True)
        
        best_child = children[0]
        
        # If best is Pass, check alternatives
        if best_child.action['type'] == 'pass':
            for cand in children[1:]:
                if cand.action['type'] == 'pass': continue
                
                # Criteria to override Pass:
                # 1. Win Rate is not significantly worse (within 5%)
                # 2. OR Visits are not significantly fewer (within 30%)
                
                wr_diff = best_child.win_rate - cand.win_rate
                visit_ratio = cand.visits / best_child.visits
                
                # If we are beating a Small Card (<=10) with a reasonable card (<=A)
                # We should be very aggressive.
                is_small_beater = False
                if root_state.last_play:
                    try:
                         # Check target rank
                         target_card = root_state.last_play['cards'][0]
                         target_rank = get_rank_value(get_rank_from_card(target_card))
                         
                         # Check my rank
                         my_card = cand.action['cards'][0]
                         my_rank = get_rank_value(get_rank_from_card(my_card))
                         
                         if target_rank <= 10 and my_rank <= 14:
                             is_small_beater = True
                    except:
                        pass

                if is_small_beater:
                     # Relaxed criteria for small beaters
                     # Beating a small card (<=10) is critical to stop opponent momentum.
                     # We tolerate a larger win rate drop (up to 25%) to force a play.
                     diff_limit = 0.25
                     if wr_diff < diff_limit: 
                         best_child = cand
                         print(f"MCTS Override: Switched from Pass to {cand.action['desc']} (Small Beater Bias, Diff: {wr_diff:.3f})")
                         break
                     else:
                         print(f"MCTS Override Skipped: Diff {wr_diff:.3f} > {diff_limit} for {cand.action['desc']}")
                
                # Standard Criteria
                if wr_diff < 0.05 and visit_ratio > 0.5:
                    best_child = cand
                    print(f"MCTS Override: Switched from Pass to {cand.action['desc']} (Play Bias)")
                    break
        
        # Add metrics to action
        action = best_child.action.copy()
        
        action['win_rate'] = best_child.win_rate
        action['visits'] = best_child.visits
        action['iterations'] = iterations
        
        return action

    def expand(self, node: MCTSNode) -> MCTSNode:
        action = node.untried_actions.pop()
        next_state = node.state.clone()
        next_state.step(action)
        child_node = MCTSNode(next_state, parent=node, action=action)
        
        # Use a unique key for the action
        # Combining type, cards ranks/suits
        # Add a random component to key to handle duplicate actions if any (though unlikely with strict dict)
        key = f"{action['type']}_{len(action['cards'])}_{random.randint(0,100000)}"
        node.children[key] = child_node
        return child_node

    def rollout(self, state: GuandanEnv) -> float:
        # If we have a Value Network, use it to estimate value of this state
        if self.model:
            from .env import state_to_vector # Local import to avoid circular dependency
            
            # Convert state to vector
            # But state_to_vector needs to handle the "current player perspective".
            # The model predicts value for the CURRENT player's team (or Team 0).
            # Model output: 1.0 means Team 0 wins. -1.0 means Team 1 wins.
            
            vec = state_to_vector(state)
            value = self.model.predict(vec) # Returns scalar [-1, 1] (Team 0 perspective)
            
            return value

        # Otherwise, standard Random Rollout
        # Simulate until done
        current_state = state.clone() # Don't mutate the node's state
        depth = 0
        max_depth = 60 # Prevent infinite loops
        
        while not current_state.is_done() and depth < max_depth:
            actions = current_state.get_legal_actions()
            if not actions:
                break
            
            # Heuristic Policy
            action = self._heuristic_policy(actions, current_state)
            
            _, reward, done, _ = current_state.step(action)
            if done:
                return reward # 1 for Team 0, -1 for Team 1
            depth += 1
            
        return 0 # Draw/Cutoff

    def _heuristic_policy(self, actions: List[Dict], state: GuandanEnv = None) -> Dict:
        """
        Bias towards playing cards (especially small ones) over passing.
        Implements user principles:
        1. Smallest Beater (Avoid Overkill)
        2. Partner Synergy (Don't beat partner unless passing through)
        3. Lead Small (Play small cards first)
        """
        # Epsilon-greedy Exploration in Rollout
        # This helps discover sequences that the deterministic heuristic might miss
        # (e.g. Leading High to prevent opponent from regaining lead)
        if random.random() < 0.3: # 30% chance to play random move
            return random.choice(actions)

        pass_action = next((a for a in actions if a['type'] == 'pass'), None)
        play_actions = [a for a in actions if a['type'] != 'pass']

        # If no play actions, forced to pass (or invalid state)
        if not play_actions:
            return pass_action if pass_action else actions[0]

        # --- Sort Actions (Principle 1 & 3) ---
        # Sort by PowerRank (Type) then Card Rank (Value) to pick smallest beater.
        def action_sort_key(a):
            # 1. PowerRank (Type)
            # Map logic.py types to comparable values
            type_map = {
                "1": 1, "single": 1,
                "2": 2, "pair": 2,
                "3": 3, "triple": 3,
                "3+2": 4, "full_house": 4,
                "straight": 5,
                "wooden_board": 6,
                "steel_plate": 6,
                "bomb": 10, # Generic bomb
                "king_bomb": 15,
                "straight_flush": 12
            }
            # Fallback to logic.POWER_RANK if not in map
            p_rank = type_map.get(a['type'], POWER_RANK.get(a['type'], 0))
            
            # 2. Card Rank (Relative Power)
            if a['cards']:
                c = a['cards'][0]
                r_val = get_rank_value(get_rank_from_card(c))
                
                # Adjust for Level Card: It acts as rank 15 (Above A=14, Below SJ=20)
                if state:
                    level_val = state.current_level
                    if r_val == level_val:
                        r_val = 15 
            else:
                r_val = 0
                
            return (p_rank, r_val)

        play_actions.sort(key=action_sort_key)

        # --- Avoid Overkill (Principle 3) ---
        # If we can follow the type (e.g. Single vs Single), do NOT use Bombs.
        # This saves bombs for critical moments and prevents "Bombing a 6 when you have a 7".
        if state and state.last_play:
            lp_type = state.last_play.get('type')
            
            # Normalize logic types
            simple_types = ["1", "single", "2", "pair", "3", "triple", "3+2", "full_house", "straight", "wooden_board", "steel_plate"]
            if lp_type in simple_types:
                # Check if we have any matching type moves
                # Map generic types for comparison
                def normalize_type(t):
                    m = {"single": "1", "pair": "2", "triple": "3", "full_house": "3+2"}
                    return m.get(t, t)
                    
                target_simple = normalize_type(lp_type)
                has_matching_type = any(normalize_type(a['type']) == target_simple for a in play_actions)
                
                if has_matching_type:
                    # Filter out Bombs
                    play_actions = [a for a in play_actions if a['type'] not in ["bomb", "king_bomb", "straight_flush"]]


        # --- Partner Synergy (Principle 4) ---
        if state and state.last_play:
            current_p = state.current_player
            last_p = state.last_player_idx
            is_partner = (current_p + 2) % 4 == last_p
            
            if is_partner:
                filtered_actions = []
                for action in play_actions:
                    # 1. No Bombs against partner (unless forced/strategic, but here we avoid)
                    if action['type'].startswith('bomb') or action['type'] == 'king_bomb':
                        continue

                    # 2. Avoid Overkill / Blocking Partner with High Cards
                    # "Don't use valuable resources (A, Level, Joker) to consume opponent resources"
                    # Applies even more to partner.
                    # Definition of High: A (14), Level (15), SJ (20), BJ (21)
                    if action['cards']:
                        c = action['cards'][0]
                        r_val = get_rank_value(get_rank_from_card(c))
                        level_val = state.current_level
                        
                        # Check Level Card
                        if r_val == level_val: r_val = 15
                        
                        # Threshold: Avoid A(14) or higher against partner
                        # Allow K(13) and below for "Passing Through"
                        if r_val >= 14:
                            continue
                            
                    filtered_actions.append(action)
                
                # If we have "Safe" moves (Passing Through), play the smallest one
                if filtered_actions:
                    return filtered_actions[0]
                
                # If only "Bad" moves (Bombs, High Cards) left against partner -> PASS
                if pass_action:
                    return pass_action

        # --- Resource Conservation (Principle 3: Don't use AAA33 to beat 77744) ---
        # If the smallest valid move is "Too Big" (Overkill) and we are following, PASS.
        if state and state.last_play:
            best_play = play_actions[0] # Smallest valid move
            
            # Check gap for Structured Types (Pair, Triple, FH, Straight, etc) and Singles
            # Skip if we are Bombing (Bomb logic handled elsewhere/allowed if necessary)
            if best_play['type'] not in ['bomb', 'king_bomb', 'straight_flush']:
                
                # Calculate Rank Value of our move
                if best_play['cards']:
                    c_my = best_play['cards'][0]
                    r_my = get_rank_value(get_rank_from_card(c_my))
                    if hasattr(state, 'current_level') and r_my == state.current_level: r_my = 15
                else:
                    r_my = 0
                    
                # Calculate Rank Value of target
                c_target = state.last_play['cards'][0]
                
                # DEBUG: Deep Inspection
                # if state.current_player == 1:
                #      print(f"DEBUG: P1 Target Card: {c_target} Type: {type(c_target)}")
                #      r_str = get_rank_from_card(c_target)
                #      print(f"DEBUG: RankStr: {r_str}")

                r_target = get_rank_value(get_rank_from_card(c_target))
                
                # DEBUG: Check Level
                # if state.current_player == 1:
                #      print(f"DEBUG: P1 Heuristic Check - TargetRank: {r_target}, Level: {state.current_level if hasattr(state, 'current_level') else 'None'}")

                if hasattr(state, 'current_level') and r_target == state.current_level: r_target = 15
                
                # Define Overkill Thresholds
                # If my rank is High (>= Ace/14) AND Gap is Large (> 4)
                
                gap = r_my - r_target
                is_high_value = r_my >= 14 # A, Level, 2, Joker

                # Exception for Singles: Only Overkill if using Joker (>=20) on small cards
                # Playing A (14) on 5 (5) is Gap 9, but usually necessary to win lead.
                # User Complaint: "Everyone pass on 10". Even Level Card (15) should play.
                # So we DISABLE Overkill check for all Singles unless it's a Joker.
                # if best_play['type'] in ['1', 'single']:
                #    if r_my < 20: # Not a Joker
                #        is_high_value = False
                #        # print(f"DEBUG: Single Overkill Check Disabled for {r_my} vs {r_target}")
                
                # DEBUG: Trace P1 (Player 1) behavior
                # if state.current_player == 1:
                #    print(f"DEBUG: P1 Heuristic - BestPlay: {best_play['desc']} (r_my={r_my}) vs Target (r_target={r_target}) Gap={gap} HighVal={is_high_value}")

                if is_high_value and gap > 4:
                    if pass_action:
                        # print(f"DEBUG: Passing due to Overkill: Player {state.current_player} {best_play['type']} {r_my} vs {r_target} (Gap {gap})")
                        # return pass_action
                        pass # DISABLE OVERKILL FOR TESTING
            
            else:
                # --- Bomb Restraint (Principle 4: Don't waste Bomb on non-critical singles) ---
                # If we are Bombing (and opponent didn't play a Bomb), check if it's worth it.
                # Only restrain if we are escalating (target is NOT a bomb).
                
                lp_type = state.last_play.get('type')
                if lp_type not in ['bomb', 'king_bomb', 'straight_flush']:
                    should_pass = False
                    
                    # Get Rank Value of target
                    c_target = state.last_play['cards'][0]
                    r_target = get_rank_value(get_rank_from_card(c_target))
                    if hasattr(state, 'current_level') and r_target == state.current_level: r_target = 15
                    
                    # 1. Single: Don't bomb unless Rank >= Small Joker (20)
                    if lp_type in ['1', 'single']:
                        if r_target < 20:
                            should_pass = True

                            
                    # 2. Pair: Don't bomb unless Rank >= A (14)
                    elif lp_type == '2':
                        if r_target < 14:
                            should_pass = True
                            
                    # 3. Triple/FullHouse/Straight/Plate: Don't bomb unless Rank >= A (14)
                    elif lp_type in ['3', '3+2', 'straight', 'wooden_board', 'steel_plate']:
                        if r_target < 14:
                            should_pass = True
                            
                    if should_pass and pass_action:
                         # print(f"Passing Bomb on non-critical {lp_type} {r_target}")
                         return pass_action

        # --- Default Strategy ---
        # Play the smallest valid move (Lead or Follow)
        return play_actions[0]

    def backpropagate(self, node: MCTSNode, result: float):
        while node:
            node.visits += 1
            node.value += result
            node = node.parent
