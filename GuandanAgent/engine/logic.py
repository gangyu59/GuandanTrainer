
from typing import List, Dict, Any, Optional
from engine.cards import Card, Rank, Suit

# Power Ranks
POWER_RANK = {
    "bomb_8": 13, # Top Tier
    "bomb_7": 12, # Top Tier
    "bomb_6": 11, # Strong
    "bomb_6_plus": 11, # Fallback
    "straight_flush": 10,
    "bomb_5": 9,
    "bomb_4": 8,
    "bomb_5_less": 8, 
    "steel_plate": 8,
    "wooden_board": 8,
    "straight": 6,
    "full_house": 5,
    "triple": 3,
    "pair": 2,
    "single": 1
}

# Heuristic Weights
# User Request: 70% Hand Count, 30% Power.
# Weight Ratio 3:1.
WEIGHT_POWER = 10
WEIGHT_HAND_COUNT = 30

def get_rank_value(rank_str: str) -> int:
    """Helper to get comparable value for rank."""
    order = {
        "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
        "J": 11, "Q": 12, "K": 13, "A": 14, "SJ": 20, "BJ": 21
    }
    return order.get(rank_str, 0)

def get_rank_index(rank_str: str) -> int:
    """Helper to get sequential index for checking consecutiveness (2-A)."""
    # Map for consecutive checks. 2 is 2, ..., A is 14.
    order = {
        "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
        "J": 11, "Q": 12, "K": 13, "A": 14
    }
    return order.get(rank_str, -1)

def sort_hand(cards: List[Any]) -> List[Any]:
    """Sort cards by value."""
    return sorted(cards, key=lambda c: (get_rank_value(get_rank_from_card(c)), get_suit_from_card(c)))

def group_cards(hand: List[Any]) -> Dict[str, List[Any]]:
    """Group cards by rank."""
    groups = {}
    for card in hand:
        rank = get_rank_from_card(card)
        if rank not in groups:
            groups[rank] = []
        groups[rank].append(card)
    return groups

def get_rank_from_card(card: Any) -> str:
    """Helper to handle both Card objects and dictionary representations."""
    if isinstance(card, dict):
        val = card.get('rank')
    else:
        val = card.rank
    
    if hasattr(val, 'value'):
        return str(val.value)
    return str(val)

def get_suit_from_card(card: Any) -> str:
    """Helper to handle both Card objects and dictionary representations."""
    if isinstance(card, dict):
        return card.get('suit')
    return card.suit

def get_rank_label(card: Any) -> str:
    """Helper to get string label for rank (e.g. '5' instead of 'Rank.R5')."""
    r = get_rank_from_card(card)
    if hasattr(r, 'value'):
        return str(r.value)
    return str(r)

def find_straight_flushes(hand: List[Any], all_combinations: bool = False, wild_budget: int = 0) -> List[Dict[str, Any]]:
    """
    Find Straight Flushes (5 consecutive cards of same suit).
    Supports wild_budget to fill gaps.
    If all_combinations=True, returns all overlapping candidates.
    Otherwise returns greedy non-overlapping set.
    """
    candidates = []
    # Group by suit
    suits = {}
    for card in hand:
        suit = get_suit_from_card(card)
        if suit not in suits:
            suits[suit] = []
        suits[suit].append(card)
    
    for suit, cards in suits.items():
        # Sort by rank index
        # Filter valid ranks for straights
        valid_cards = [c for c in cards if get_rank_index(get_rank_from_card(c)) != -1]
        valid_cards.sort(key=lambda c: get_rank_index(get_rank_from_card(c)))
        
        # DEBUG
        # print(f"DEBUG: SF Check Suit {suit} Valid: {len(valid_cards)} {[get_rank_from_card(c) for c in valid_cards]}")

        if not valid_cards:
            continue
            
        # Sliding window over ranks (2 to A)
        # SF length is 5.
        # Possible start ranks: 2 (2,3,4,5,6) to 10 (10,J,Q,K,A).
        # We need to map cards to ranks.
        rank_to_cards = {}
        for c in valid_cards:
            r_idx = get_rank_index(get_rank_from_card(c))
            if r_idx not in rank_to_cards:
                rank_to_cards[r_idx] = []
            rank_to_cards[r_idx].append(c)
            
        unique_ranks = sorted(rank_to_cards.keys())
        min_rank = 2
        max_rank = 14 # A
        
        # Check standard straights (2-6 to 10-A)
        search_ranges = list(range(min_rank, max_rank - 4 + 1))
        
        # Check A-2-3-4-5 (A=14, 2=2, 3=3, 4=4, 5=5)
        # We handle this as a special sequence of indices
        special_sequences = [[14, 2, 3, 4, 5]]
        
        # Standard Loop
        for start_r in search_ranges:
            needed_wilds = 0
            sf_cards = []
            
            valid_sf = True
            for offset in range(5):
                curr_r = start_r + offset
                if curr_r in rank_to_cards:
                    sf_cards.append(rank_to_cards[curr_r][0])
                else:
                    needed_wilds += 1
            
            if needed_wilds <= wild_budget:
                r_lookup = {2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9', 10:'10', 11:'J', 12:'Q', 13:'K', 14:'A'}
                s_label = r_lookup.get(start_r, str(start_r))
                e_label = r_lookup.get(start_r+4, str(start_r+4))
                
                candidates.append({
                    "action": "play",
                    "cards": sf_cards, 
                    "wilds_needed": needed_wilds,
                    "desc": f"Play Straight Flush {s_label}-{e_label} ({suit})",
                    "type": "straight_flush",
                    "power": POWER_RANK["straight_flush"]
                })
        
        # Special Sequences Loop (A-2-3-4-5)
        for seq in special_sequences:
            needed_wilds = 0
            sf_cards = []
            for r_idx in seq:
                if r_idx in rank_to_cards:
                    sf_cards.append(rank_to_cards[r_idx][0])
                else:
                    needed_wilds += 1
            
            if needed_wilds <= wild_budget:
                candidates.append({
                    "action": "play",
                    "cards": sf_cards, 
                    "wilds_needed": needed_wilds,
                    "desc": f"Play Straight Flush A-5 ({suit})",
                    "type": "straight_flush",
                    "power": POWER_RANK["straight_flush"]
                })

    if all_combinations:
        return candidates

    return candidates # Greedy filtering not implemented for wilds yet, returning all is safer for DFS

def optimize_hand_partition(hand: List[Any], current_level: int = 2) -> Dict[str, Any]:
    """
    Partition hand into best possible combinations based on PowerRank.
    Optimized to minimize leftover singles using Recursive Search with Pruning.
    Returns: { "score": int, "groups": List[Dict] }
    """
    if not hand:
        return {"score": 0, "groups": []}
        
    # 1. Identify Wild Cards
    level_rank_map = {
        2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
        11: 'J', 12: 'Q', 13: 'K', 14: 'A'
    }
    level_rank_str = level_rank_map.get(current_level, '2')
    
    wild_cards = []
    normal_cards = []
    
    for card in hand:
        r = get_rank_from_card(card)
        s = get_suit_from_card(card)
        if r == level_rank_str and s == 'H':
            wild_cards.append(card)
        else:
            normal_cards.append(card)
            
    num_wilds = len(wild_cards)
    sorted_normal = sort_hand(normal_cards)
    
    groups = []
    used_indices = set()
    
    # --- Layer 1: King Bomb (Always keep) ---
    kings = [i for i, c in enumerate(sorted_normal) if get_rank_from_card(c) in ['SJ', 'BJ']]
    if len(kings) == 4:
        group_cards_list = [sorted_normal[i] for i in kings]
        groups.append({
            "type": "king_bomb", 
            "cards": group_cards_list, 
            "power": POWER_RANK["king_bomb"]
        })
        used_indices.update(kings)

    # --- Layer 2: Wild Bombs (Priority) ---
    # Prioritize forming 6+ bombs or 4+ bombs with Wilds
    # Greedy approach for Wilds is usually optimal because they are high value.
    # We remove cards used for wild bombs from the "Normal Partitioning" pool.
    
    # Helper to check if index is used
    def is_used(idx): return idx in used_indices

    rank_groups = {}
    for i, card in enumerate(sorted_normal):
        if is_used(i): continue
        r = get_rank_from_card(card)
        if r not in rank_groups: rank_groups[r] = []
        rank_groups[r].append(i)
        
    sorted_ranks = sorted(rank_groups.items(), key=lambda x: (len(x[1]), get_rank_value(x[0])), reverse=True)
    
    # Pass 1: Form 6+ Bombs (Power 10)
    for r, indices in sorted_ranks:
        count = len(indices)
        if any(is_used(idx) for idx in indices): continue
        
        # Natural 6+
        if count >= 6:
            groups.append({
                "type": "bomb", 
                "cards": [sorted_normal[i] for i in indices], 
                "power": POWER_RANK["bomb_6_plus"]
            })
            used_indices.update(indices)
            continue
            
    # Pass 2: Use Wilds to form Bombs
    # MOVED TO DFS CANDIDATES / BASE CASE
    # We remove the greedy pass here to allow DFS to decide whether to use Wilds for Bombs or Straights.
    # The base case `get_rank_partition_score` already handles optimal wild assignment for bombs/triples.
    # And we will add specific Wild Bomb candidates to the DFS if needed (e.g. King Bomb or 6+ Bomb).

    # --- Layer 3: Optimized Partitioning of Remaining Natural Cards ---
    # Heuristic Constants (Global)
    # Using WEIGHT_POWER and WEIGHT_HAND_COUNT defined at module level
    BASE_MULTIPLIER = WEIGHT_POWER
    HAND_PENALTY = WEIGHT_HAND_COUNT

    # Prepare data for DFS
    remaining_indices = [i for i in range(len(sorted_normal)) if i not in used_indices]
    remaining_cards = [sorted_normal[i] for i in remaining_indices]
    
    if not remaining_cards:
        # Just add remaining wilds if any
        for w in wild_cards:
            groups.append({"type": "single", "cards": [w], "power": POWER_RANK["single"]})
        
        total_score = sum(g['power'] for g in groups)
        return {"score": total_score, "groups": groups}

    # Generate Candidates for Sequences
    candidates = []
    
    # Straight Flushes
    # Try with all available wilds.
    sfs = find_straight_flushes(remaining_cards, all_combinations=True, wild_budget=len(wild_cards))
    candidates.extend(sfs)
    
    # Straights
    # Need to group by unique rank for straights
    unique_singles_map = group_cards(remaining_cards)
    all_rank_groups = [cards for cards in unique_singles_map.values()]
    
    straights = find_consecutive_groups(all_rank_groups, 5, 1, wild_budget=len(wild_cards))
    for s in straights: 
        s['power'] = POWER_RANK['straight']
        candidates.append(s)
        
    # Plates
    plates = find_consecutive_groups(all_rank_groups, 2, 3, wild_budget=len(wild_cards))
    for p in plates: 
        p['power'] = POWER_RANK['steel_plate']
        candidates.append(p)
        
    # Wooden Boards
    boards = find_consecutive_groups(all_rank_groups, 3, 2, wild_budget=len(wild_cards))
    for b in boards: 
        b['power'] = POWER_RANK['wooden_board']
        candidates.append(b)

    # Convert candidates cards to indices in `remaining_cards` for easy checking
    # This is tricky because `remaining_cards` has duplicates.
    # We map card objects to their index in `remaining_cards`.
    # Assuming card objects are unique in memory or we use index.
    # Since `find_xxx` returns card objects, we can map back.
    card_to_idx = {id(c): i for i, c in enumerate(remaining_cards)}
    
    candidate_indices = []
    for cand in candidates:
        indices = []
        valid = True
        for c in cand['cards']:
            if id(c) in card_to_idx:
                indices.append(card_to_idx[id(c)])
            else:
                valid = False
                break
        if valid:
            # Check for duplicates in indices (e.g. if find logic reused same card? unlikely)
            candidate_indices.append({
                "indices": set(indices),
                "data": cand,
                "wilds_needed": cand.get('wilds_needed', 0),
                "score": cand['power'] * BASE_MULTIPLIER - HAND_PENALTY 
            })

    # Filter candidates that are subsets of better candidates? 
    # Or just let DFS handle it.
    # Sort candidates by Score desc to try best first
    candidate_indices.sort(key=lambda x: x['score'], reverse=True)
    
    # DEBUG
    # print(f"DEBUG: Candidates Found: {len(candidate_indices)}")
    # for c in candidate_indices:
    #     print(f"DEBUG: Candidate {c['data']['type']} Score {c['score']} WildsNeeded {c['wilds_needed']} Cards: {[get_rank_label(x) for x in c['data']['cards']]}")

    # DFS Cache
    memo = {}
    
    # Constants moved to top

    def get_rank_partition_score(current_mask, current_wild_count):
        """Calculate score if we just group remaining by Rank (Bombs/Triples/Pairs/Singles)."""
        # Reconstruct remaining
        current_rem = []
        for i in range(len(remaining_cards)):
            if not ((current_mask >> i) & 1):
                current_rem.append(remaining_cards[i])
        
        # We also have 'wild_cards' (list) available to use!
        # Since DFS might have consumed some wilds, we only use `current_wild_count`.
        current_wilds = wild_cards[:current_wild_count]
        
        if not current_rem and not current_wilds: return 0, []
        
        g_map = group_cards(current_rem)
        score = 0
        p_groups = []
        
        # 1. Identify patterns from Naturals
        # We'll store them as objects to allow modifying (adding wilds)
        groups_data = []
        
        for r, cards in g_map.items():
            groups_data.append({"rank": r, "cards": cards, "base_count": len(cards)})
            
        # Sort groups by count desc (Greedy: easier to upgrade larger groups)
        groups_data.sort(key=lambda x: (len(x['cards']), get_rank_value(x['rank'])), reverse=True)
        
        # 2. Distribute Wilds to Maximize Score
        # Strategy: 
        # A. Try to form 6+ Bombs (Power 10)
        # B. Try to form 4+ Bombs (Power 6)
        # C. Form Triples/Pairs/Singles
        
        # Determine Level Rank for checks
        level_rank = None
        try:
            if current_level <= 10:
                level_rank = Rank(str(current_level))
            elif current_level == 11: level_rank = Rank.J
            elif current_level == 12: level_rank = Rank.Q
            elif current_level == 13: level_rank = Rank.K
            elif current_level == 14: level_rank = Rank.A
        except:
            pass

        # Pass 1: Form 4+ Bombs (Priority: Quantity over Quality)
        # We prioritize turning Triples/Pairs into Bombs (Power 7) over making existing Bombs bigger (Power 10).
        # This addresses user feedback: "5 bombs became 3 bombs".
        for g in groups_data:
            if not current_wilds: break
            count = len(g['cards'])
            
            # Skip if already a decent bomb (6+)
            if count >= 4: continue

            # Skip if this group is composed of Level Cards (Rank == current_level)
            # User Feedback: "Stupid to form a bomb with 4 level cards, especially using Red Hearts".
            # Level cards are high control singles.
            if level_rank and g.get('rank') == level_rank:
                continue
            
            # Target 4 cards
            needed = 4 - count
            if needed > 0 and needed <= len(current_wilds):
                use = current_wilds[:needed]
                g['cards'].extend(use)
                current_wilds = current_wilds[needed:]

        # Pass 2 & 3 Removed: Do not upgrade bombs with wilds.
        # User Feedback: "Two bombs are bigger than one slightly larger bomb."
        # "Using a wild card to make a multi-card bomb is not as good as making an extra bomb."
        # We preserve wilds for other uses (or just as high singles/pairs) rather than extending bombs.
            
        # Pass 3: Upgrade 4-Bombs to 5-Bombs? (No, Power difference usually small 7->8)
        # But we might have leftover wilds.
        
        # D. Any remaining wilds -> Merge into existing groups to reduce singles
        # Try to make Wild Bombs first (Power 6) from pure wilds if we have 4+
        while len(current_wilds) >= 4:
             # Add to groups_data as a new bomb group
             # We need a rank. Use rank of first wild.
             w_rank = get_rank_from_card(current_wilds[0])
             new_group = {"rank": w_rank, "cards": current_wilds[:4], "base_count": 0}
             groups_data.append(new_group)
             current_wilds = current_wilds[4:]
             
        # Merge remaining (<4) into existing groups
        # Since we already tried to form Bombs in Step A/B, these merges won't reach Bomb status usually.
        # But they convert Pair->Triple, Single->Pair.
        for w in current_wilds:
            target = None
            # Prioritize groups < 4 to improve their structure
            for g in groups_data:
                if len(g['cards']) < 4:
                    # Skip Level Card groups
                    if level_rank and g.get('rank') == level_rank:
                        continue
                    
                    target = g
                    break
            
            # If no small group found, DO NOT force into existing big groups.
            # Leave wild as a new single (or pair if multiple).
            # This respects "Two bombs > One big bomb" and preserves control cards.
            # if not target and groups_data:
            #    target = groups_data[0]
                
            if target:
                target['cards'].append(w)
            else:
                # No groups exist or no suitable small group. Create new single.
                # Check if we can merge with existing wild singles?
                # Actually, simply appending as new group works, they will be scored as Singles/Pairs later.
                new_group = {"rank": get_rank_from_card(w), "cards": [w], "base_count": 1}
                groups_data.append(new_group)

        # 3. Calculate Final Score for Groups
        # Separate into lists for processing (Full House logic needs specific lists)
        bombs_list = []
        triples_list = []
        pairs_list = []
        singles_list = []
        
        for g in groups_data:
            c = len(g['cards'])
            if c >= 4:
                bombs_list.append(g)
            elif c == 3:
                triples_list.append(g)
            elif c == 2:
                pairs_list.append(g)
            elif c == 1:
                singles_list.append(g)
                
        # Form Full Houses (Triple + Pair)
        while triples_list and pairs_list:
            t = triples_list.pop(0)
            p = pairs_list.pop(0)
            
            combined = t['cards'] + p['cards']
            p_val = POWER_RANK["full_house"]
            score += p_val * BASE_MULTIPLIER - HAND_PENALTY
            p_groups.append({
                "type": "full_house", 
                "cards": combined, 
                "power": p_val,
                "desc": f"Full House {get_rank_label(t['cards'][0])}"
            })
            
        # Determine Level Rank for King Bomb detection
        # Removed as per user instruction: "No King Bomb concept, stupid to form."
        level_rank = None

        # Score others
        for g in bombs_list:
            c = len(g['cards'])
            p_val = POWER_RANK["bomb_4"]
            
            if c == 5: p_val = POWER_RANK["bomb_5"]
            elif c == 6: p_val = POWER_RANK["bomb_6"]
            elif c == 7: p_val = POWER_RANK["bomb_7"]
            elif c >= 8: p_val = POWER_RANK["bomb_8"]
            elif c >= 6: p_val = POWER_RANK["bomb_6_plus"]
            
            score += p_val * BASE_MULTIPLIER - HAND_PENALTY
            p_groups.append({"type": "bomb", "cards": g['cards'], "power": p_val})
            
        for g in triples_list:
            score += POWER_RANK["triple"] * BASE_MULTIPLIER - HAND_PENALTY
            p_groups.append({"type": "triple", "cards": g['cards'], "power": POWER_RANK["triple"]})
            
        for g in pairs_list:
            score += POWER_RANK["pair"] * BASE_MULTIPLIER - HAND_PENALTY
            p_groups.append({"type": "pair", "cards": g['cards'], "power": POWER_RANK["pair"]})
            
        for g in singles_list:
            score += POWER_RANK["single"] * BASE_MULTIPLIER - HAND_PENALTY
            p_groups.append({"type": "single", "cards": g['cards'], "power": POWER_RANK["single"]})
            
        # Add Wild Singles Score (already added to p_groups above)
        # Note: We didn't add their score to `score` variable loop above
        for g in p_groups:
             # Check if it was a wild single added directly
             if g['cards'][0] in wild_cards and g not in [x for x in groups_data]: 
                 # Wait, logic mixing. 
                 # We added wild groups to p_groups but didn't add to `score`.
                 pass
        
        # Recalculate score from p_groups to be safe
        score = 0
        for g in p_groups:
             score += g['power'] * BASE_MULTIPLIER - HAND_PENALTY
             
        return score, p_groups

    def dfs(mask, current_wild_count):
        state = (mask, current_wild_count)
        if state in memo: return memo[state]
        
        # Base case: Calculate score from Rank Partitioning
        best_score, best_grps = get_rank_partition_score(mask, current_wild_count)
        
        # Try picking a candidate
        for cand in candidate_indices:
            # Check overlap
            c_indices = cand['indices']
            wilds_needed = cand['wilds_needed']
            
            # Check wild budget
            if wilds_needed > current_wild_count:
                continue
                
            # Convert indices to mask check
            # Mask bit 1 = Used.
            overlap = False
            for idx in c_indices:
                if (mask >> idx) & 1:
                    overlap = True
                    break
            
            if not overlap:
                # Apply candidate
                new_mask = mask
                for idx in c_indices:
                    new_mask |= (1 << idx)
                
                # Consume wilds
                rem_score, rem_grps = dfs(new_mask, current_wild_count - wilds_needed)
                
                current_total = cand['score'] + rem_score
                
                if current_total > best_score:
                    best_score = current_total
                    # Add used wilds to this candidate group if needed
                    final_cand_group = cand['data'].copy()
                    if wilds_needed > 0:
                        # Take specific wild cards from the pool
                        # We are using the 'last' wilds available (conceptually)
                        # current_wild_count available. We use `wilds_needed`.
                        # Let's say we have 2 wilds: W1, W2.
                        # We use 1. We pass 1 to recursion.
                        # Which one did we use? wild_cards[current_wild_count - 1] ?
                        # Or wild_cards[0] ?
                        # get_rank_partition_score uses wild_cards[:count].
                        # So it uses the FIRST `count`.
                        # So we should use the LAST `wilds_needed`?
                        # Or we just take from the pool.
                        # Let's say we use `wild_cards[current_wild_count - wilds_needed : current_wild_count]`
                        used_w = wild_cards[current_wild_count - wilds_needed : current_wild_count]
                        final_cand_group['cards'] = final_cand_group['cards'] + used_w
                        
                    best_grps = [final_cand_group] + rem_grps
        
        memo[state] = (best_score, best_grps)
        return best_score, best_grps

    # Run DFS
    # Initial mask 0 (all available), full wild count
    _, best_partition_groups = dfs(0, len(wild_cards))
    
    groups.extend(best_partition_groups)
    
    # Note: remaining wilds are already handled in get_rank_partition_score
    # and included in best_partition_groups.

    # Recalculate total power score for user (not heuristic score)
    final_score = sum(g['power'] for g in groups)
    
    return {"score": final_score, "groups": groups}

def find_consecutive_groups(groups: List[List[Any]], count: int, width: int, wild_budget: int = 0) -> List[Dict[str, Any]]:
    """
    Helper to find consecutive groups like Straights, Plates, Boards.
    Supports Wild Cards to fill gaps (width or length).
    Generates multiple disjoint candidates (Depth) if possible.
    """
    candidates = []
    
    # 1. Map Rank Index -> List of Cards
    rank_map = {}
    valid_ranks = []
    
    for g in groups:
        if not g: continue
        r_idx = get_rank_index(get_rank_from_card(g[0]))
        if r_idx != -1:
            rank_map[r_idx] = g
            valid_ranks.append(r_idx)
            
    if not rank_map:
        return []
        
    # 2. Iterate all possible start ranks (2 to A)
    # Max start is A - count + 1. (A=14)
    min_r = 2
    max_r = 14
    
    search_ranges = list(range(min_r, max_r - count + 2))
    
    # Special Sequence for A-2-3-4-5 (if count == 5)
    special_sequences = []
    if count == 5 and width == 1: # Only for Straights
        special_sequences.append([14, 2, 3, 4, 5])
    
    # Standard Sequences
    for start_r in search_ranges:
        # Check this window [start_r, start_r + count - 1]
        # ... logic ...
        
        # Try to form candidates at increasing depth k=0, 1, ...
        # We stop when we run out of wilds/cards for a depth.
        
        for k in range(100): # Safety limit, effectively infinite
            cand_cards = []
            cand_wilds_needed = 0
            possible = True
            
            # Check each rank in sequence
            for offset in range(count):
                curr_r = start_r + offset
                cards_at_rank = rank_map.get(curr_r, [])
                
                # We need 'width' cards for this rank.
                # We want the k-th chunk: [k*width : (k+1)*width]
                s_idx = k * width
                e_idx = s_idx + width
                
                # Available naturals
                available_count = len(cards_at_rank)
                
                if s_idx < available_count:
                    # We have some naturals
                    take_end = min(e_idx, available_count)
                    cand_cards.extend(cards_at_rank[s_idx:take_end])
                    
                    taken_count = take_end - s_idx
                    missing = width - taken_count
                    cand_wilds_needed += missing
                else:
                    # No naturals left for this depth
                    cand_wilds_needed += width
            
            if cand_wilds_needed > wild_budget:
                break # Cannot form any more at this depth
            
            # Valid candidate
            start_label = get_rank_label_from_index(start_r)
            end_label = get_rank_label_from_index(start_r + count - 1)
            
            t_name = "straight"
            if width == 3: t_name = "steel_plate"
            elif width == 2: t_name = "wooden_board"
            
            candidates.append({
                "action": "play",
                "cards": cand_cards,
                "wilds_needed": cand_wilds_needed,
                "desc": f"Play {t_name.replace('_', ' ').title()} {start_label}-{end_label}",
                "type": t_name
            })

            # VARIATION LOGIC:
            # If width == 1 (Straights), try to swap cards if alternatives exist.
            if width == 1 and k == 0 and cand_wilds_needed <= wild_budget:
                 # For each rank in sequence
                 for offset in range(count):
                     curr_r = start_r + offset
                     cards_at_rank = rank_map.get(curr_r, [])
                     # Check if we have an alternative card (index 1)
                     if len(cards_at_rank) > 1:
                         if offset < len(cand_cards):
                             variant_cards = list(cand_cards)
                             # Note: cand_cards might be shorter if wilds used? 
                             # But for width=1, cand_cards length = count - wilds_used
                             # If we have wild, we might not have card at offset?
                             # Logic: rank_map has cards. 
                             # If we took a card for this rank, it is in cand_cards.
                             # But finding WHICH index in cand_cards corresponds to `curr_r` is tricky if there are wilds.
                             # Actually, cand_cards order matches sequence order ONLY if we append in order.
                             # We append in loop order.
                             # But if we skip a rank (wild), we append nothing.
                             # So we need to track index in cand_cards.
                             
                             # Re-calculate index
                             c_idx = 0
                             found_card_idx = -1
                             for o2 in range(offset):
                                 r2 = start_r + o2
                                 if rank_map.get(r2) and k < len(rank_map.get(r2)):
                                     c_idx += 1
                             
                             # Now c_idx points to the card for `curr_r` IF it exists
                             if c_idx < len(cand_cards) and rank_map.get(curr_r) and k < len(rank_map.get(curr_r)):
                                  variant_cards[c_idx] = cards_at_rank[1]
                                  candidates.append({
                                    "action": "play",
                                    "cards": variant_cards,
                                    "wilds_needed": cand_wilds_needed,
                                    "desc": f"Play {t_name.replace('_', ' ').title()} {start_label}-{end_label} (Var)",
                                    "type": t_name
                                 })

    # Special Sequences (A-2-3-4-5)
    for seq in special_sequences:
        for k in range(100):
            cand_cards = []
            cand_wilds_needed = 0
            
            for r_idx in seq:
                cards_at_rank = rank_map.get(r_idx, [])
                s_idx = k * width
                e_idx = s_idx + width
                available_count = len(cards_at_rank)
                
                if s_idx < available_count:
                    take_end = min(e_idx, available_count)
                    cand_cards.extend(cards_at_rank[s_idx:take_end])
                    taken_count = take_end - s_idx
                    cand_wilds_needed += (width - taken_count)
                else:
                    cand_wilds_needed += width
            
            if cand_wilds_needed > wild_budget:
                break
                
            candidates.append({
                "action": "play",
                "cards": cand_cards,
                "wilds_needed": cand_wilds_needed,
                "desc": f"Play Straight A-5",
                "type": "straight"
            })
            
    return candidates

def get_rank_label_from_index(idx):
    r_lookup = {2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9', 10:'10', 11:'J', 12:'Q', 13:'K', 14:'A'}
    return r_lookup.get(idx, str(idx))


def get_legal_moves(my_hand: List[Any], last_play: Any, current_level: int = 2) -> List[Dict[str, Any]]:
    """
    Generate legal moves based on current hand and last play.
    Supports: Single, Pair, Triple, Full House, Straight, Plate, Wooden Board, Bomb, Straight Flush
    Includes Wild Card (Level Card Heart) support for Bombs.
    """
    moves = []
    
    # Identify Wild Cards (Red Hearts of Current Level)
    # Convert level to rank string (2->'2', ..., 10->'10', 11->'J', 12->'Q', 13->'K', 14->'A')
    level_rank_map = {
        2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
        11: 'J', 12: 'Q', 13: 'K', 14: 'A'
    }
    level_rank_str = level_rank_map.get(current_level, '2')
    
    # Separate Wild Cards and Normal Cards
    wild_cards = []
    normal_cards = []
    
    for card in my_hand:
        r = get_rank_from_card(card)
        s = get_suit_from_card(card)
        # Check if it is a wild card (Rank matches level AND Suit is Hearts)
        if r == level_rank_str and s == 'H':
            wild_cards.append(card)
        else:
            normal_cards.append(card)
            
    num_wilds = len(wild_cards)
    
    sorted_hand = sort_hand(my_hand) # Kept for general logic
    # Use normal_cards for grouping to avoid polluting groups with wild cards when looking for base patterns
    sorted_normal = sort_hand(normal_cards)
    grouped_normal = group_cards(sorted_normal)
    
    grouped_hand = group_cards(sorted_hand) # Original grouping (includes wilds as their face value)
    
    # Pre-calculate groups
    singles = sorted_hand
    # Group singles by rank for straight detection (need unique ranks)
    unique_singles_map = group_cards(singles)
    unique_singles = [cards for cards in unique_singles_map.values()] # List of lists
    
    pairs = [cards for cards in grouped_hand.values() if len(cards) >= 2]
    triples = [cards for cards in grouped_hand.values() if len(cards) >= 3]
    bombs = [cards for cards in grouped_hand.values() if len(cards) >= 4] # Basic bombs (natural)
    
    # Generate Advanced Types
    straights = find_consecutive_groups(unique_singles, 5, 1)
    plates = find_consecutive_groups(triples, 2, 3)
    boards = find_consecutive_groups(pairs, 3, 2)
    straight_flushes = find_straight_flushes(singles)
    
    # Check for 4 Kings
    kings = [c for c in singles if get_rank_from_card(c) in ['SJ', 'BJ']]
    king_bomb = None
    if len(kings) == 4:
        king_bomb = {
            "action": "play",
            "cards": kings,
            "desc": "Play Heavenly King Bomb",
            "type": "bomb"
        }

    # Helper to add bombs to moves list
    all_bombs = []
    for b in bombs:
        all_bombs.append({
            "action": "play",
            "cards": b,
            "desc": f"Play Bomb {get_rank_label(b[0])} ({len(b)} cards)",
            "type": "bomb"
        })
        
    # --- WILD CARD BOMB GENERATION ---
    if num_wilds > 0:
        # Try to form bombs with every normal rank
        for rank, cards in grouped_normal.items():
            count = len(cards)
            # If we can make a bomb (at least 4 cards total)
            if count + num_wilds >= 4:
                # 1. Max Power Bomb (All wilds)
                combined = cards + wild_cards
                all_bombs.append({
                    "action": "play",
                    "cards": combined,
                    "desc": f"Play Wild Bomb {get_rank_label(cards[0])} ({len(combined)} cards)",
                    "type": "bomb"
                })
                
                # 2. Min Necessary Bomb (Just enough to make 4, or 5 if we want diversity)
                # Only if different from max power
                needed = 4 - count
                if needed > 0 and needed < num_wilds:
                    subset_wilds = wild_cards[:needed]
                    combined_min = cards + subset_wilds
                    all_bombs.append({
                        "action": "play",
                        "cards": combined_min,
                        "desc": f"Play Wild Bomb {get_rank_label(cards[0])} ({len(combined_min)} cards)",
                        "type": "bomb"
                    })
    
    for sf in straight_flushes:
        all_bombs.append(sf)
    if king_bomb:
        all_bombs.append(king_bomb)
    
    # Always allow PASS if it's not a free turn
    if last_play and last_play.get("cards") and len(last_play.get("cards")) > 0:
        moves.append({"action": "pass", "cards": [], "desc": "Pass", "type": "pass"})
    
    # 1. Free Play (Leader)
    if not last_play or not last_play.get("cards") or len(last_play.get("cards")) == 0:
        # Suggest Singles (Top 3 smallest)
        seen_ranks = set()
        count = 0
        for card in singles:
            if card.rank not in seen_ranks:
                moves.append({
                    "action": "play",
                    "cards": [card],
                    "desc": f"Play Single {get_rank_label(card)}",
                    "type": "1"
                })
                seen_ranks.add(card.rank)
                count += 1
                if count >= 3: break
        
        # Suggest Pairs (Top 2 smallest)
        pairs.sort(key=lambda x: get_rank_value(x[0].rank))
        for p in pairs[:2]:
            moves.append({
                "action": "play",
                "cards": p[:2],
                "desc": f"Play Pair {get_rank_label(p[0])}",
                "type": "2"
            })
            
        # Suggest Triples (Top 1 smallest)
        triples.sort(key=lambda x: get_rank_value(x[0].rank))
        for t in triples[:1]:
            moves.append({
                "action": "play",
                "cards": t[:3],
                "desc": f"Play Triple {get_rank_label(t[0])}",
                "type": "3"
            })
            # Try to form a Full House (3+2) if possible
            if len(pairs) > 0:
                # Find smallest pair not overlapping with triple (ranks are different)
                for p in pairs:
                    if p[0].rank != t[0].rank:
                         moves.append({
                            "action": "play",
                            "cards": t[:3] + p[:2],
                            "desc": f"Play Full House {get_rank_label(t[0])} with {get_rank_label(p[0])}",
                            "type": "3+2"
                        })
                         break # Just one suggestion is enough
        
        # Suggest Straights
        for s in straights[:1]: # Suggest smallest straight
             moves.append(s)
             
        # Suggest Plates
        for p in plates[:1]:
            moves.append(p)
            
        # Suggest Wooden Boards
        for b in boards[:1]:
            moves.append(b)
            
        # Suggest Bombs (Just smallest normal bomb, and Straight Flush if any)
        # Sort all bombs by score
        all_bombs.sort(key=lambda x: get_bomb_score(x['cards'], x['type']))
        if all_bombs:
            moves.append(all_bombs[0])

    # 2. Follow Play
    else:
        target_cards = last_play.get("cards", [])
        target_type = last_play.get("type", "unknown")
        
        # Infer type if unknown or generic
        if not target_type or target_type == "unknown":
            t_grouped = group_cards(target_cards)
            counts = sorted([len(v) for v in t_grouped.values()])
            unique_ranks = sorted(t_grouped.keys(), key=lambda r: get_rank_value(r))
            
            # Check for Kings (Heavenly Bomb)
            if len(target_cards) == 4 and all(c.rank in ['SJ', 'BJ'] for c in target_cards):
                target_type = "bomb" # King Bomb
            # Check for General Bomb (All same rank, count >= 4)
            elif len(t_grouped) == 1 and len(target_cards) >= 4:
                target_type = "bomb"
            elif len(target_cards) == 1: 
                target_type = "1"
            elif len(target_cards) == 2: 
                target_type = "2"
            elif len(target_cards) == 3: 
                target_type = "3"
            elif len(target_cards) == 5: 
                if counts == [2, 3]:
                    target_type = "3+2"
                else:
                    # Check Straight Flush vs Straight
                    suits = set(get_suit_from_card(c) for c in target_cards)
                    if len(suits) == 1:
                        target_type = "straight_flush"
                    else:
                        target_type = "straight"
            elif len(target_cards) == 6: 
                if counts == [3, 3]:
                    target_type = "steel_plate" 
                elif counts == [2, 2, 2]:
                    target_type = "wooden_board"
                # Note: 6-card bomb handled by first check
            
        target_val = get_rank_value(get_rank_from_card(target_cards[0])) if target_cards else 0
        # For structured types, target_val usually implies the rank of the largest card in the sequence or the triplet
        # Adjust target_val for special types
        if target_type == "3+2":
            # Find the triple's rank
            t_grouped = group_cards(target_cards)
            for r, cards in t_grouped.items():
                if len(cards) == 3:
                    target_val = get_rank_value(r)
                    break
        elif target_type in ["steel_plate", "wooden_board", "straight"]:
             # Use the smallest rank to compare start-to-start, or largest to compare end-to-end?
             # Standard is usually comparing the largest card in the sequence.
             # But our generators (find_consecutive_groups) return 'cards' sorted.
             # Let's use the first card's rank (start of sequence) for consistency with generators.
             # But wait, target_cards might not be sorted.
             sorted_target = sort_hand(target_cards)
             target_val = get_rank_value(get_rank_from_card(sorted_target[0]))
        
        # If target is NOT a bomb, we can beat with same type OR any bomb
        if target_type not in ["bomb", "straight_flush"]:
            # Same Type Logic
            if target_type == "1":
                seen_ranks = set()
                count = 0
                for card in singles:
                    if get_rank_value(card.rank) > target_val:
                        if card.rank not in seen_ranks:
                            moves.append({
                                "action": "play",
                                "cards": [card],
                                "desc": f"Play Single {get_rank_label(card)}",
                                "type": "1"
                            })
                            seen_ranks.add(card.rank)
                            count += 1
                            if count >= 3: break
                            
            elif target_type == "2":
                pairs.sort(key=lambda x: get_rank_value(x[0].rank))
                for p in pairs:
                    if get_rank_value(p[0].rank) > target_val:
                        moves.append({
                            "action": "play",
                            "cards": p[:2],
                            "desc": f"Play Pair {get_rank_label(p[0])}",
                            "type": "2"
                        })
                        if len(moves) > 3: break
            
            elif target_type == "3":
                triples.sort(key=lambda x: get_rank_value(x[0].rank))
                for t in triples:
                    if get_rank_value(t[0].rank) > target_val:
                        moves.append({
                            "action": "play",
                            "cards": t[:3],
                            "desc": f"Play Triple {get_rank_label(t[0])}",
                            "type": "3"
                        })
                        if len(moves) > 2: break

            elif target_type == "3+2":
                triples.sort(key=lambda x: get_rank_value(x[0].rank))
                for t in triples:
                    if get_rank_value(t[0].rank) > target_val:
                        # Need a pair (any pair, even small one)
                        # Prefer smallest pair
                        pairs.sort(key=lambda x: get_rank_value(x[0].rank))
                        found_pair = None
                        for p in pairs:
                            if p[0].rank != t[0].rank:
                                found_pair = p
                                break
                        
                        if found_pair:
                            moves.append({
                                "action": "play",
                                "cards": t[:3] + found_pair[:2],
                                "desc": f"Play Full House {get_rank_label(t[0])} with {get_rank_label(found_pair[0])}",
                                "type": "3+2"
                            })
                            # Only suggest one best 3+2 for this triple
                            continue

            elif target_type == "straight":
                 for s in straights:
                     if get_rank_value(s['cards'][0].rank) > target_val:
                         moves.append(s)
                         if len(moves) > 1: break
            
            elif target_type == "steel_plate":
                 for p in plates:
                     if get_rank_value(p['cards'][0].rank) > target_val:
                         moves.append(p)
                         if len(moves) > 1: break
                         
            elif target_type == "wooden_board":
                 for b in boards:
                     if get_rank_value(b['cards'][0].rank) > target_val:
                         moves.append(b)
                         if len(moves) > 1: break
            
            # Also add Bombs (Any bomb beats non-bomb)
            # Suggest smallest bomb
            all_bombs.sort(key=lambda x: get_bomb_score(x['cards'], x['type']))
            if all_bombs:
                moves.append(all_bombs[0]) # Smallest bomb
                
        else:
            # Target IS a Bomb (or Straight Flush)
            target_score = get_bomb_score(target_cards, target_type)
            
            # Find bombs with higher score
            winning_bombs = []
            for b in all_bombs:
                if get_bomb_score(b['cards'], b['type']) > target_score:
                    winning_bombs.append(b)
            
            winning_bombs.sort(key=lambda x: get_bomb_score(x['cards'], x['type']))
            
            # Suggest smallest winning bomb
            if winning_bombs:
                moves.append(winning_bombs[0])

    return moves

def calculate_hand_strength(hand: List[Any], current_level: int = 2) -> Dict[str, Any]:
    """
    Calculate Hand Strength using PowerRank-based Partitioning.
    Returns:
      - score: Total PowerRank Score
      - groups: List of groups
      - num_bombs: Count of bombs
      - desc: Description string
    """
    if not hand:
        return {"score": 0, "groups": [], "num_bombs": 0, "desc": "Empty Hand"}
        
    result = optimize_hand_partition(hand, current_level=current_level)
    
    score = result['score']
    groups = result['groups']
    
    # Calculate Metadata
    num_bombs = sum(1 for g in groups if g['type'] in ['bomb', 'king_bomb', 'straight_flush'])
    
    # Scale score to look nicer (0-100 range approximation)
    # 10 is max power for a group. 27 cards -> maybe 5-6 groups.
    # Typical score 30-60.
    # No need to scale heavily.
    
    return {
        "score": score,
        "groups": groups,
        "num_bombs": num_bombs,
        "desc": f"Power Score: {score} (Bombs: {num_bombs})"
    }
