
from typing import List, Dict, Any, Optional
# Try relative import first, then absolute, then package-based
try:
    from engine.cards import Card, Rank, Suit
    from engine.logic import (
        optimize_hand_partition, get_rank_value, get_rank_from_card, 
        sort_hand
    )
except ImportError:
    try:
        from GuandanAgent.engine.cards import Card, Rank, Suit
        from GuandanAgent.engine.logic import (
            optimize_hand_partition, get_rank_value, get_rank_from_card, 
            sort_hand
        )
    except ImportError:
        # Fallback for relative (if run as script in engine/)
        from .cards import Card, Rank, Suit
        from .logic import (
            optimize_hand_partition, get_rank_value, get_rank_from_card, 
            sort_hand
        )

# --- HappyGuandan Type Mapping & Priority ---

class CardType:
    Single = "Single"
    Pair = "Pair"
    Triple = "Triple"
    FullHouse = "FullHouse"
    Tractor = "Tractor"      # Wooden Board (3 consecutive pairs)
    Plane = "Plane"          # Steel Plate (2 consecutive triples)
    Straight = "Straight"
    Bomb = "Bomb"
    FlushStraight = "FlushStraight"
    SkyBomb = "SkyBomb"      # King Bomb
    Unknown = "Unknown"

# Priority: Higher wins (for different types comparisons, though usually types must match)
# Exception: Bomb/SkyBomb/FlushStraight beat others.
PRIORITY = {
    CardType.Single: 1,
    CardType.Pair: 2,
    CardType.Triple: 3,
    CardType.Straight: 4,
    CardType.FullHouse: 5,
    CardType.Tractor: 6,
    CardType.Plane: 7,
    CardType.FlushStraight: 8,
    CardType.Bomb: 9,
    CardType.SkyBomb: 10,
}

TYPE_MAPPING = {
    # logic.py types
    "single": CardType.Single,
    "pair": CardType.Pair,
    "triple": CardType.Triple,
    "full_house": CardType.FullHouse,
    "straight": CardType.Straight,
    "wooden_board": CardType.Tractor,
    "steel_plate": CardType.Plane,
    "bomb": CardType.Bomb,
    "bomb_5_less": CardType.Bomb,
    "bomb_4": CardType.Bomb,
    "bomb_5": CardType.Bomb,
    "bomb_6": CardType.Bomb,
    "bomb_6_plus": CardType.Bomb,
    "bomb_7": CardType.Bomb,
    "bomb_8": CardType.Bomb,
    "straight_flush": CardType.FlushStraight,
    "king_bomb": CardType.SkyBomb,
    
    # Frontend / CardRules.ts types
    "triplet": CardType.Triple,
    "triplet_with_pair": CardType.FullHouse,
    "big_bomb": CardType.Bomb,
    "super_bomb": CardType.SkyBomb,
    
    # Legacy/Fallback types
    "1": CardType.Single,
    "2": CardType.Pair,
    "3": CardType.Triple,
    "3+2": CardType.FullHouse,
}

def map_logic_type_to_happy(logic_type: str) -> str:
    return TYPE_MAPPING.get(logic_type, CardType.Unknown)

def get_happy_rank_value(card: Any) -> int:
    """
    Map logic.py rank values to a comparable integer.
    logic.py: 2=2, ..., A=14, SJ=20, BJ=21
    HappyGuandan JS: 2=0, ..., A=12, SJ=13, BJ=14
    We can just use logic.py's values as they preserve order.
    """
    return get_rank_value(get_rank_from_card(card))

def get_guandan_rank_value(card: Any, current_level: int) -> int:
    """
    Get rank value considering Level Card promotion.
    Normal: 2..14, SJ=20, BJ=21
    Level Card: Promoted to 15 (Between A and SJ).
    """
    val = get_rank_value(get_rank_from_card(card))
    if val == current_level:
        return 15
    return val


# --- Comparison Logic (Replicating cardTypes.js) ---

def compare_single(hand_a, hand_b, current_level=2):
    val_a = get_guandan_rank_value(hand_a['cards'][0], current_level)
    val_b = get_guandan_rank_value(hand_b['cards'][0], current_level)
    return val_a - val_b

def compare_pair(hand_a, hand_b, current_level=2):
    return compare_single(hand_a, hand_b, current_level)

def compare_triple(hand_a, hand_b, current_level=2):
    return compare_single(hand_a, hand_b, current_level)

def compare_full_house(hand_a, hand_b, current_level=2):
    # Compare the Triple part
    def get_triple_rank(cards):
        counts = {}
        for c in cards:
            r = get_rank_from_card(c)
            counts[r] = counts.get(r, 0) + 1
        for r, count in counts.items():
            if count >= 3:
                # Create a dummy card to get rank value
                # Suit doesn't matter for value check
                return get_guandan_rank_value(Card(Suit.HEARTS, r), current_level)
        return 0
    
    return get_triple_rank(hand_a['cards']) - get_triple_rank(hand_b['cards'])

def compare_straight(hand_a, hand_b, current_level=2):
    # Compare largest card
    return get_guandan_rank_value(hand_a['cards'][-1], current_level) - get_guandan_rank_value(hand_b['cards'][-1], current_level)

def compare_bomb(hand_a, hand_b, current_level=2):
    if len(hand_a['cards']) != len(hand_b['cards']):
        return len(hand_a['cards']) - len(hand_b['cards'])
    return get_guandan_rank_value(hand_a['cards'][0], current_level) - get_guandan_rank_value(hand_b['cards'][0], current_level)

# Map comparison functions
COMPARE_FUNCS = {
    CardType.Single: compare_single,
    CardType.Pair: compare_pair,
    CardType.Triple: compare_triple,
    CardType.FullHouse: compare_full_house,
    CardType.Straight: compare_straight,
    CardType.Bomb: compare_bomb,
    CardType.SkyBomb: compare_bomb, # Treated like Bomb
    CardType.FlushStraight: compare_straight,
    # Tractor/Plane use rank of first pair/triple (assuming sorted)
    CardType.Tractor: compare_pair, 
    CardType.Plane: compare_triple 
}

def compare_hands(hand_a, hand_b, current_level=2):
    """
    Compare two hands. Returns > 0 if A > B.
    """
    # Use happy_type for priority lookup if available
    type_a = hand_a.get('happy_type', hand_a.get('type'))
    type_b = hand_b.get('happy_type', hand_b.get('type'))
    
    p_a = PRIORITY.get(type_a, 0)
    p_b = PRIORITY.get(type_b, 0)

    if p_a != p_b:
        return p_a - p_b
    
    # Types match (or are in same priority tier)
    ht = hand_a.get('happy_type')
    func = COMPARE_FUNCS.get(ht)
    
    if func:
        return func(hand_a, hand_b, current_level)
    return 0

# --- Sorting Logic ---

def sort_groups_happy_style(groups: List[Dict[str, Any]], current_level: int = 2) -> List[Dict[str, Any]]:
    """
    Sort groups to match HappyGuandan's cardGroup:
    1. Priority Descending (SkyBomb -> Single)
    2. Rank/Value Descending (Big -> Small)
    """
    # Convert logic types to happy types
    for g in groups:
        if 'happy_type' not in g:
            g['happy_type'] = map_logic_type_to_happy(g['type'])
    
    def sort_key(g):
        # Primary: Priority (High to Low)
        p = PRIORITY.get(g['happy_type'], 0)
        # Secondary: Value (High to Low)
        # We use a generic value getter.
        # For Bombs, length matters too, but Priority handles Bomb vs Single.
        # Within Bomb, compare_bomb handles length then rank.
        # But for global sort, we want strict ordering.
        # Let's use a simplified value:
        val = 0
        if g['cards']:
            val = get_guandan_rank_value(g['cards'][0], current_level)
            # Adjust for Full House (use triple rank)
            if g['happy_type'] == CardType.FullHouse:
                # Re-calc triple rank
                counts = {}
                for c in g['cards']:
                    r = get_rank_from_card(c)
                    counts[r] = counts.get(r, 0) + 1
                for r, count in counts.items():
                    if count >= 3:
                        val = get_guandan_rank_value(Card(Suit.HEARTS, r), current_level)
                        break
            elif g['happy_type'] == CardType.Straight or g['happy_type'] == CardType.FlushStraight:
                val = get_guandan_rank_value(g['cards'][-1], current_level)
            elif g['happy_type'] == CardType.Bomb:
                # Bombs: Length first, then Rank.
                # To mix with "Rank Descending", we need to encode Length.
                # HappyGuandan sorts Bombs by Length ASC, then Rank ASC.
                # But here we want the GLOBAL list to be [SkyBomb, Bomb(Big), ..., Bomb(Small), ..., Single].
                # Wait, HappyGuandan's `populateCardGroup` sorts `organizedHands[type]` by `-compareHands(a, b)`.
                # `compareHands` returns A-B.
                # So `-compareHands` means B-A. Sorts Descending (Big First).
                # So `cardGroup` has [Big Single, ..., Small Single].
                
                # For Bombs: `compareBomb` checks Length first.
                # So `cardGroup` has [Big Length Bomb, ..., Small Length Bomb].
                
                # So we just need to use `compareHands` for the secondary key.
                # Python sort key needs a comparable value.
                pass
        
        return (p, val, len(g['cards']))

    # Python's sort is stable. We can sort by value first, then type.
    # But compareHands is complex.
    # Let's use `cmp_to_key` for full control if needed, or just multiple passes.
    
    # Let's sort by Type first (fixed buckets).
    buckets = {t: [] for t in PRIORITY.values()}
    for g in groups:
        p = PRIORITY.get(g['happy_type'], 0)
        if p in buckets:
            buckets[p].append(g)
    
    final_list = []
    # Iterate Priority High -> Low
    for p in sorted(buckets.keys(), reverse=True):
        g_list = buckets[p]
        # Sort internal list by compareHands Descending (Big -> Small)
        from functools import cmp_to_key
        def cmp(a, b):
            # We want Descending, so if A > B, return -1.
            res = compare_hands(a, b, current_level)
            return -res 
            
        g_list.sort(key=cmp_to_key(cmp))
        final_list.extend(g_list)
        
    return final_list

# --- Main Decision Logic ---

def decide_move(hand: List[Card], last_play: Optional[Dict[str, Any]], current_level: int = 2, my_player_index: int = -1) -> Dict[str, Any]:
    """
    Main entry point for HappyGuandan Strategy.
    """
    if not last_play:
        return _decide_lead_move(hand, current_level)
    else:
        return _decide_follow_move(hand, last_play, current_level, my_player_index)

def _decide_lead_move(hand: List[Card], current_level: int = 2) -> Dict[str, Any]:
    """
    Rule 2 (Lead to Clear Trash):
    1. Scan for Straights (5 consecutive singles). If exists, play it first.
    2. Else, clear "trash" (Smallest Single or Pair).
    """
    partition = optimize_hand_partition(hand, current_level)
    groups = partition.get("groups", [])
    
    if not groups:
        # Fallback for Lead: If partition fails but hand has cards, play smallest single.
        if hand:
            sorted_hand = sort_hand(hand)
            # Smallest is FIRST in sort_hand (Ascending order 2->A).
            smallest_card = sorted_hand[0]
            return {
                "action": "play",
                "cards": [smallest_card],
                "type": "single",
                "desc": "Lead Fallback: Smallest Single"
            }
        return {"action": "pass"}

    sorted_groups = sort_groups_happy_style(groups, current_level)
    
    # CHECK FOR HIDDEN SINGLES (Masked by Straights/Groups)
    # User feedback: "Has 6, 7 singles. AI leads 7. 6 was masked in a Straight?"
    # Find absolute smallest single in hand (excluding Bombs)
    protected_sigs = set()
    for g in sorted_groups:
        if g['happy_type'] in [CardType.Bomb, CardType.SkyBomb, CardType.FlushStraight]:
            for c in g['cards']:
                protected_sigs.add(f"{c.suit}-{c.rank}")
                
    smallest_raw_card = None
    smallest_raw_val = 100
    
    for c in hand:
        if f"{c.suit}-{c.rank}" in protected_sigs:
            continue
        val = get_guandan_rank_value(c, current_level)
        if val < smallest_raw_val:
            smallest_raw_val = val
            smallest_raw_card = c
            
    # If we found a card smaller than our best trash (or any straight), lead it!
    # (Breaks Straights/Triples/Pairs to lead absolute smallest)
    if smallest_raw_card:
        # Determine current best lead value
        current_best_val = 100
        
        # Check Straights first
        has_straight = False
        for g in sorted_groups:
             if g['happy_type'] == CardType.Straight:
                 has_straight = True
                 break
        
        # Check Trash
        trash_candidates = []
        for g in sorted_groups:
            if g['happy_type'] in [CardType.Single, CardType.Pair]:
                trash_candidates.append(g)
        
        if trash_candidates:
             trash_candidates.sort(key=lambda x: get_guandan_rank_value(x['cards'][0], current_level))
             current_best_val = get_guandan_rank_value(trash_candidates[0]['cards'][0], current_level)
        elif has_straight:
             pass
             
        # FORCE LEAD SMALLER: If hidden single is strictly smaller than best trash (if any), lead it.
        
        # Check group type of smallest_raw_card
        source_group = None
        for g in sorted_groups:
            for c in g['cards']:
                if c.suit == smallest_raw_card.suit and c.rank == smallest_raw_card.rank:
                    source_group = g
                    break
            if source_group: break
        
        should_break = False
        
        is_source_straight_5 = False
        if source_group and source_group['happy_type'] in [CardType.Straight, CardType.FlushStraight]:
            if len(source_group['cards']) == 5:
                is_source_straight_5 = True
        
        if trash_candidates:
            if is_source_straight_5:
                # NEVER break a 5-card Straight to lead a single.
                should_break = False
            else:
                # Source is Pair, Triple, or Long Straight.
                # Aggressively break for smaller lead.
                if smallest_raw_val < current_best_val:
                    should_break = True
        elif has_straight:
             # Break straight to lead smallest?
             if is_source_straight_5:
                 # Breaking 5-straight leaves garbage. Generally avoid.
                 should_break = False
             else:
                 # Long straight (6+). Breaking one off leaves 5+.
                 if smallest_raw_val <= 10:
                     should_break = True
        elif not trash_candidates and not has_straight:
             # Only big groups left. Break them?
             if smallest_raw_val <= 10:
                 should_break = True

        if should_break:
            return {
                "action": "play",
                "cards": [smallest_raw_card],
                "type": "single",
                "desc": "Rule 2: Lead Hidden Smallest (breaking group)"
            }

    # Priority 1: Check for Straights
    for g in sorted_groups:
        if g['happy_type'] == CardType.Straight:
             return {
                "action": "play",
                "cards": g['cards'],
                "type": g['type'],
                "desc": "Rule 2: Lead Straight to clear cards"
            }

    # Priority 2: Clear Smallest Single or Pair (Trash)
    # Collect all trash candidates first
    trash_candidates = []
    for g in sorted_groups:
        if g['happy_type'] in [CardType.Single, CardType.Pair]:
            trash_candidates.append(g)
            
    # If no Single/Pair trash found (e.g. only Triples/Bombs left), play smallest group available.
    if not trash_candidates:
        best_group = sorted_groups[-1] # Last element is Smallest
        return {
            "action": "play",
            "cards": best_group['cards'],
            "type": best_group['type'],
            "desc": f"Lead Smallest: {best_group['type']}"
        }

    # Sort trash candidates
    def get_g_val(grp):
        if grp['cards']:
            return get_guandan_rank_value(grp['cards'][0], current_level)
        return 100
        
    trash_candidates.sort(key=get_g_val)
    best_trash = trash_candidates[0]

    return {
        "action": "play",
        "cards": best_trash['cards'],
        "type": best_trash['type'],
        "desc": f"Rule 2: Lead Trash ({best_trash['type']})"
    }

def _find_fallback_move(hand: List[Card], last_play: Dict[str, Any], target_type: str, protected_groups: List[Dict[str, Any]] = None, current_level: int = 2) -> Dict[str, Any]:
    """
    Search raw hand for a move of target_type that beats last_play.
    Used when optimal partition fails to provide a move.
    CRITICAL: Do NOT use cards from Protected Groups (Bombs/SF/KingBomb).
    """
    if not hand:
        return None
        
    # 1. Identify Protected Cards (Using Suit/Rank signatures)
    protected_sigs = set()
    if protected_groups:
        for g in protected_groups:
            # Protect Bombs, Straight Flush, King Bomb
            if g.get('happy_type') in [CardType.Bomb, CardType.FlushStraight, CardType.SkyBomb]:
                 for c in g['cards']:
                     protected_sigs.add(f"{c.suit}-{c.rank}")
                     
    # Group by rank
    rank_groups = {}
    for c in hand:
        # SKIP Protected Cards
        if f"{c.suit}-{c.rank}" in protected_sigs:
            continue
            
        r = get_rank_from_card(c)
        if r not in rank_groups:
            rank_groups[r] = []
        rank_groups[r].append(c)
        
    needed_count = 1
    if target_type == CardType.Pair:
        needed_count = 2
    elif target_type == CardType.Triple:
        needed_count = 3
        
    # Find candidates
    candidates = []
    for r, cards in rank_groups.items():
        if len(cards) >= needed_count:
            # Create a candidate group
            cand_cards = cards[:needed_count]
            cand = {
                "type": "single" if needed_count == 1 else ("pair" if needed_count == 2 else "triple"),
                "happy_type": target_type,
                "cards": cand_cards
            }
            
            # Check if beats last_play
            if compare_hands(cand, last_play, current_level) > 0:
                candidates.append(cand)
                
    if not candidates:
        return None
        
    # Sort candidates by value (Small -> Big) to find smallest beater
    candidates.sort(key=lambda x: get_guandan_rank_value(x['cards'][0], current_level))
    
    best = candidates[0]
    return {
        "action": "play",
        "cards": best['cards'],
        "type": best['type'], # Logic type
        "desc": f"HappyStrategy Fallback: {best['type']} beats {last_play.get('type')}"
    }

def _decide_follow_move(hand: List[Card], last_play: Dict[str, Any], current_level: int = 2, my_player_index: int = -1) -> Dict[str, Any]:
    """
    Implements 4 Rules Heuristic:
    1. Pass & No Random Bombing: Follow with smallest non-bomb. No bombs unless sprinting (<=6 cards).
    2. Rule 3 (No Overkill): Pass if smallest beater is too big (e.g. >10 vs <10) and hand > 5.
    3. Rule 4 (Partner Cooperation): Pass on partner's big cards. Beat partner's small cards only with small cards.
    """
    partition = optimize_hand_partition(hand, current_level)
    groups = partition.get("groups", [])
    
    sorted_groups = sort_groups_happy_style(groups, current_level)
    
    # Convert last_play to happy format for comparison
    lp_happy_type = map_logic_type_to_happy(last_play['type'])
    lp_obj = {
        "type": lp_happy_type,
        "cards": last_play['cards'],
        "happy_type": lp_happy_type
    }

    # Identify Partner
    is_partner_play = False
    last_idx = last_play.get('player_index')
    if my_player_index != -1 and last_idx is not None:
        if (my_player_index % 2) == (last_idx % 2) and my_player_index != last_idx:
            is_partner_play = True
            
    # Rule 4: Partner Check - Initial Filter
    # If partner played something "Big", strict Pass.
    lp_val = 0
    if lp_obj['cards']:
        if lp_happy_type in [CardType.Straight, CardType.FlushStraight]:
            lp_val = get_guandan_rank_value(lp_obj['cards'][-1], current_level)
        else:
            lp_val = get_guandan_rank_value(lp_obj['cards'][0], current_level)
            
    is_lp_bomb = lp_happy_type in [CardType.Bomb, CardType.SkyBomb, CardType.FlushStraight]
    
    if is_partner_play:
        if is_lp_bomb:
             return {"action": "pass", "desc": "Rule 4: Partner played Bomb -> Pass"}
        if lp_happy_type == CardType.Straight:
             return {"action": "pass", "desc": "Rule 4: Partner played Straight -> Pass"}
        if lp_happy_type == CardType.FullHouse and lp_val > 10:
             return {"action": "pass", "desc": "Rule 4: Partner played Big FullHouse -> Pass"}
        if lp_val > 10: # J, Q, K, A, Kings
             return {"action": "pass", "desc": "Rule 4: Partner played Big Card -> Pass"}
             
    # Find Candidates (Smallest -> Largest)
    candidates = []
    
    # Hand Size for Sprinting Check
    hand_size = len(hand)
    is_sprinting = hand_size <= 6

    # Iterate Small -> Big
    for i in range(len(sorted_groups) - 1, -1, -1):
        cand = sorted_groups[i]
        
        is_cand_bomb = cand['happy_type'] in [CardType.Bomb, CardType.SkyBomb, CardType.FlushStraight]
        
        # Rule 1: No Random Bombing
        if not is_lp_bomb and is_cand_bomb:
            if not is_sprinting:
                continue # Skip bomb
            
            # SPRINTING REFINEMENT (User Feedback):
            # "Impossible to use SF to bomb single"
            # Protect SF/SkyBomb unless it is the FINAL move (clears hand).
            if cand['happy_type'] in [CardType.FlushStraight, CardType.SkyBomb]:
                # If playing this bomb does NOT clear the hand, don't use it on non-bomb.
                if len(hand) > len(cand['cards']):
                    continue
                
        # Partner Logic (Rule 4 continued):
        if is_partner_play:
            cand_val = 0
            if cand['cards']:
                 if cand['happy_type'] in [CardType.Straight, CardType.FlushStraight]:
                    cand_val = get_guandan_rank_value(cand['cards'][-1], current_level)
                 else:
                    cand_val = get_guandan_rank_value(cand['cards'][0], current_level)
            
            if cand_val > 10:
                continue # Don't beat partner's small card with my big card
                
        # Validity Check
        # 1. Type Match
        if cand['happy_type'] == lp_obj['happy_type']:
            if compare_hands(cand, lp_obj, current_level) > 0:
                candidates.append(cand)
                break # Found smallest beater!
        
        # 2. Bomb Logic (Bomb beats non-Bomb)
        elif is_cand_bomb and not is_lp_bomb:
             candidates.append(cand)
             break # Found smallest bomb beater
             
        # 3. Bomb vs Bomb
        elif is_cand_bomb and is_lp_bomb:
             cand_p = PRIORITY.get(cand['happy_type'], 0)
             lp_p = PRIORITY.get(lp_obj['happy_type'], 0)
             if cand_p > lp_p:
                 candidates.append(cand)
                 break
             elif cand_p == lp_p:
                 if compare_hands(cand, lp_obj, current_level) > 0:
                     candidates.append(cand)
                     break

    if not candidates:
        # Fallback Search (only for non-bomb types)
        if not is_lp_bomb:
            fallback = _find_fallback_move(hand, lp_obj, lp_obj['happy_type'], protected_groups=groups, current_level=current_level)
            if fallback:
                return fallback
        return {"action": "pass"}

    best_partition_move = candidates[0] # Smallest beater found (from Partition)
    
    # ALWAYS check Fallback for a BETTER (Smaller) option
    # (Fixes "Played 8 when 4 available inside Straight" issue)
    # Note: Even if sprinting (<=6 cards), we prefer playing "Smallest Beater" if it's strictly smaller.
    if not is_lp_bomb and not is_partner_play:
        fallback = _find_fallback_move(hand, lp_obj, lp_obj['happy_type'], protected_groups=groups, current_level=current_level)
        if fallback:
            # Compare fallback vs partition move
            fb_val = get_guandan_rank_value(fallback['cards'][0], current_level)
            pt_val = get_guandan_rank_value(best_partition_move['cards'][0], current_level)
            
            # Check source of fallback cards to avoid breaking Pairs/Triples unless necessary
            should_fallback = False
            
            # 1. Identify source group type
            fallback_cards_ids = set(id(c) for c in fallback['cards'])
            source_group_type = None
            for g in groups:
                for c in g['cards']:
                    if id(c) in fallback_cards_ids:
                        source_group_type = g['happy_type']
                        break
                if source_group_type: break
            
            # 2. Decision Logic
            if fb_val < pt_val:
                if source_group_type in [CardType.Pair, CardType.Triple, CardType.FullHouse]:
                    # Don't break structure if Partition Move is reasonable (<= A)
                    if pt_val <= 14: # A or smaller
                        should_fallback = False
                    else:
                        should_fallback = True
                else:
                    # Straight or other: OK to break for smaller card
                    should_fallback = True
            
            if should_fallback:
                return fallback

    best_move = best_partition_move

    # Rule 3: No Overkill
    if not is_partner_play and not is_lp_bomb and not is_sprinting:
        cand_val = 0
        if best_move['cards']:
             cand_val = get_guandan_rank_value(best_move['cards'][0], current_level)
        
        # Overkill Threshold
        # Default: 10 (Don't use >10 to beat <=10)
        # Relaxed for Singles: 14 (Allow J, Q, K, A to beat small cards). Only Level Card/Joker is Overkill.
        overkill_threshold = 10
        if best_move['happy_type'] == CardType.Single:
            overkill_threshold = 14

        if cand_val > overkill_threshold and lp_val <= 10:
             if hand_size > 5:
                 # Overkill detected!
                 # Before passing, try Fallback to see if we have a smaller card buried in a Straight/Group.
                 fallback = _find_fallback_move(hand, lp_obj, lp_obj['happy_type'], protected_groups=groups, current_level=current_level)
                 if fallback:
                     # Check if fallback is also overkill
                     fb_val = get_guandan_rank_value(fallback['cards'][0], current_level)
                     if not (fb_val > 10 and lp_val <= 10):
                         return fallback
                 
                 return {"action": "pass", "desc": "Rule 3: Overkill Protection (Pass)"}

    return {
        "action": "play",
        "cards": best_move['cards'],
        "type": best_move['type'],
        "desc": f"Rule 1/3/4: {best_move['type']} beats {last_play['type']}"
    }

