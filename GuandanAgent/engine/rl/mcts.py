
import math
import time
import random
from typing import Dict, List, Any
from .env import GuandanEnv

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
    def __init__(self, time_limit_ms=2000):
        self.time_limit_ms = time_limit_ms

    def search(self, root_state: GuandanEnv) -> Dict[str, Any]:
        root_node = MCTSNode(root_state.clone())
        
        end_time = time.time() + (self.time_limit_ms / 1000.0)
        
        iterations = 0
        while time.time() < end_time:
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
            
        # Select best action (robust child: most visits)
        best_child = max(root_node.children.values(), key=lambda c: c.visits)
        return best_child.action

    def expand(self, node: MCTSNode) -> MCTSNode:
        action = node.untried_actions.pop()
        next_state = node.state.clone()
        next_state.step(action)
        child_node = MCTSNode(next_state, parent=node, action=action)
        
        # Use a unique key for the action
        # Combining type, cards ranks/suits
        key = f"{action['type']}_{len(action['cards'])}_{random.randint(0,10000)}"
        node.children[key] = child_node
        return child_node

    def rollout(self, state: GuandanEnv) -> float:
        # Simulate until done
        current_state = state.clone() # Don't mutate the node's state
        depth = 0
        max_depth = 60 # Prevent infinite loops
        
        while not current_state.is_done() and depth < max_depth:
            actions = current_state.get_legal_actions()
            if not actions:
                break
            
            # Random policy
            # Optimization: Prefer playing cards over passing if possible?
            # Or just pure random. Pure random is "stupid" but unbiased.
            action = random.choice(actions)
            
            _, reward, done, _ = current_state.step(action)
            if done:
                return reward # 1 for Team 0, -1 for Team 1
            depth += 1
            
        return 0 # Draw/Cutoff

    def backpropagate(self, node: MCTSNode, result: float):
        while node:
            node.visits += 1
            node.value += result
            node = node.parent
