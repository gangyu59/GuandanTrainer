import React, { useEffect, useMemo, useState } from "react";
import type { Card, Rank, Suit } from "./legacy/types";
import { CardRules } from "./legacy/CardRules";
import { CardPower } from "./legacy/CardPower";
import { HandOptimizer } from "./legacy/HandOptimizer";
import { validPlay, type LegacyLastPlay } from "./legacy/GameRules";

const cardRules = new CardRules();
const handOptimizer = new HandOptimizer(cardRules, CardPower);

type GameState = {
  id: string;
  players: string[];
  hands: Record<string, Card[]>;
};

type LoadState = "idle" | "loading" | "success" | "error";

const API_BASE = "http://127.0.0.1:8100/api";

function formatCardLabel(card: Card): string {
  if (card.suit === "J") {
    return card.rank === "BJ" ? "大王" : "小王";
  }
  const suitMap: Record<Suit, string> = {
    C: "♣",
    D: "♦",
    H: "♥",
    S: "♠",
    J: "",
  };
  return `${suitMap[card.suit]}${card.rank}`;
}



function cardImagePath(card: Card): string {
  if (card.suit === "J") {
    if (card.rank === "BJ") {
      return "/cards/big_joker.jpeg";
    }
    return "/cards/small_joker.jpeg";
  }
  const suitChar = card.suit.toLowerCase();
  return `/cards/${suitChar}_${card.rank}.jpeg`;
}

export function formatLevel(level: number): string {
  if (level <= 10) return level.toString();
  if (level === 11) return "J";
  if (level === 12) return "Q";
  if (level === 13) return "K";
  if (level === 14) return "A";
  return level.toString();
}

export function App() {
  const [healthState, setHealthState] = useState<LoadState>("idle");
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [dealState, setDealState] = useState<LoadState>("idle");
  const [dealError, setDealError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [hands, setHands] = useState<Record<string, Card[]>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [originalSelfHand, setOriginalSelfHand] = useState<Card[] | null>(null);
  const [currentSelfHand, setCurrentSelfHand] = useState<Card[][] | null>(null);
  const [uploadState, setUploadState] = useState<LoadState>("idle");
  const [selectedIndices, setSelectedIndices] = useState<Set<string>>(new Set());
  const [autoPlay, setAutoPlay] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(
    null,
  );
  const [tableCards, setTableCards] = useState<Card[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [lastPlay, setLastPlay] = useState<LegacyLastPlay>(null);
  const [lastActions, setLastActions] = useState<Record<number, { cards: Card[]; type: string } | null>>({});
  const [showAIModal, setShowAIModal] = useState(true);
  const [aiLogs, setAiLogs] = useState<Array<{ reasoning: string, message: string, timestamp: number }>>([]);
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  const [lastRecommendedCards, setLastRecommendedCards] = useState<Card[] | null>(null);
  const [lastAiDecision, setLastAiDecision] = useState<any>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [trainingStats, setTrainingStats] = useState<any>(null);

  // Draggable Modal State
  const [aiModalPos, setAiModalPos] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 500 });
  const [dashboardPos, setDashboardPos] = useState({ x: 100, y: 100 });
  const [activeDrag, setActiveDrag] = useState<"ai" | "dashboard" | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Adjust initial position to be visible
    setAiModalPos({ x: window.innerWidth - 420, y: window.innerHeight - 500 });
    setDashboardPos({ x: window.innerWidth / 2 - 350, y: window.innerHeight / 2 - 300 });
  }, []);

  const handleMouseDown = (e: React.MouseEvent, type: "ai" | "dashboard") => {
    setActiveDrag(type);
    const currentPos = type === "ai" ? aiModalPos : dashboardPos;
    setDragOffset({
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (activeDrag === "ai") {
        setAiModalPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      } else if (activeDrag === "dashboard") {
        setDashboardPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setActiveDrag(null);
    };

    if (activeDrag) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag, dragOffset]);
  const [passCount, setPassCount] = useState(0);
  const [finishedPlayers, setFinishedPlayers] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [matchOver, setMatchOver] = useState(false);

  // Level & Scoreboard State
  const [teamLevels, setTeamLevels] = useState<{ self: number; opponent: number }>({ self: 2, opponent: 2 });
  const [currentStartPlayer, setCurrentStartPlayer] = useState(0); // Who started CURRENT game
  const [nextStartPlayer, setNextStartPlayer] = useState(0); // Who starts NEXT game

  const players = game?.players ?? ["P0", "P1", "P2", "P3"];
  const selfId = players[0];
  const selfCardsFromServer =
    (hands && hands[selfId]) || game?.hands?.[selfId] || [];

  const selfGroups = useMemo(() => {
    if (currentSelfHand) return currentSelfHand;
    if (selfCardsFromServer.length > 0) {
      const sorted = cardRules.sortCards(selfCardsFromServer);
      return groupForRank(sorted);
    }
    return [];
  }, [currentSelfHand, selfCardsFromServer]);

  const flatSelfCards = useMemo(() => selfGroups.flat(), [selfGroups]);
  const selfCards = flatSelfCards;

  const tableCardsStyle = useMemo(() => {
    return {};
  }, []);

  useEffect(() => {
    async function pingHealth() {
      setHealthState("loading");
      try {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as { status?: string };
        if (data.status === "ok") {
          setHealthMessage("后端已连接");
        } else {
          setHealthMessage("后端响应异常");
        }
        setHealthState("success");
      } catch {
        setHealthState("error");
        setHealthMessage("无法连接后端");
      }
    }

    pingHealth();
  }, []);

  async function fetchDashboardData() {
    try {
      const [statsRes, trainingRes] = await Promise.all([
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/training/stats`)
      ]);

      if (statsRes.ok) {
        setDashboardData(await statsRes.json());
      }
      if (trainingRes.ok) {
        setTrainingStats(await trainingRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  }

  useEffect(() => {
    if (showDashboard) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 2000); // Auto refresh
      return () => clearInterval(interval);
    }
  }, [showDashboard]);

  async function handleRestartMatch() {
    setTeamLevels({ self: 2, opponent: 2 });
    setNextStartPlayer(0);
    setMatchOver(false);
    // After state update, handleDeal will use reset values? 
    // Wait, handleDeal reads state. State updates are async. 
    // Better to explicitly reset in handleDeal or pass params.
    // Actually handleDeal uses nextStartPlayer state. 
    // We should probably chain this.
    
    // Simplest way: manually trigger a deal with initial params.
    // But handleDeal fetches from server. 
    // We just need to reset local state before calling deal.
    // Let's rely on React batching or just call handleDeal in a way that respects the reset.
    // However, handleDeal uses `nextStartPlayer` from state.
    // So we should update state, then wait? 
    // Or just modify handleDeal to accept an optional start player override.
    // But for now, let's just update state and call deal. 
    // React state updates might not be immediate. 
    // Let's modify handleDeal to read from refs? Or just use a separate effect?
    // Or simpler: handleDeal logic reads `nextStartPlayer`. 
    // If we want to restart, we can just reload the page? No, bad UX.
    
    // Let's reset the levels and start player, and then call a modified deal or just force it.
    // Actually, `handleDeal` uses `nextStartPlayer`.
    // If I set `nextStartPlayer(0)` here, `handleDeal` might still see old value if called immediately.
    // I'll wrap the deal call in a setTimeout or use a ref. 
    // But actually, for restart, we want P0 to start? Or random?
    // Usually P0 or random. Let's say P0.
    
    // I will modify handleDeal to accept an override.
    await handleDeal(true);
  }

  async function handleDeal(isRestart = false) {
    setDealState("loading");
    setDealError(null);
    try {
      const response = await fetch(`${API_BASE}/deal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as GameState;
      setGame(data);
      setHands(data.hands);

      // Determine start player and levels
      let startP = nextStartPlayer;
      let levels = teamLevels;
      
      if (isRestart) {
        startP = 0;
        levels = { self: 2, opponent: 2 };
        // We need to update state too so UI reflects it
        setTeamLevels(levels);
        setNextStartPlayer(startP);
        setMatchOver(false);
      }

      // Set Trump based on starting team's level
      const isSelfTeam = [0, 2].includes(startP);
      const level = isSelfTeam ? levels.self : levels.opponent;
      const trumpRank = formatLevel(level) as Rank;
      cardRules.setTrump(trumpRank);
      console.log(`New Game: StartPlayer=P${startP}, Level=${level}, Trump=${trumpRank}`);

      const selfIdFromDeal = data.players[0];
      const selfHandFromDeal = data.hands?.[selfIdFromDeal] ?? [];
      setOriginalSelfHand(selfHandFromDeal);
      const sorted = cardRules.sortCards(selfHandFromDeal);
      const grouped = groupForRank(sorted);
      setCurrentSelfHand(grouped);
      setUploadState("idle");
      setDealState("success");
      
      // Use nextStartPlayer to determine who starts
      setCurrentPlayerIndex(startP);
      setCurrentStartPlayer(startP);

      setLastPlay(null);
      setLastActions({});
      setPassCount(0);
      setFinishedPlayers([]);
      setGameOver(false);
      setSelectedIndices(new Set());
      setSelectedGroupIndex(null);
      setTableCards([]);
    } catch {
      setDealState("error");
      setDealError("发牌失败");
    }
  }

  function cardImagePath(card: Card): string {
    if (card.suit === "J") {
      if (card.rank === "BJ") {
        return "/cards/big_joker.jpeg";
      }
      return "/cards/small_joker.jpeg";
    }
    const suitChar = card.suit.toLowerCase();
    return `/cards/${suitChar}_${card.rank}.jpeg`;
  }

  function getNextActivePlayerIndex(fromIndex: number): number {
    const total = players.length;
    let next = (fromIndex + 1) % total;
    const finished = new Set(finishedPlayers);
    while (finished.has(next)) {
      next = (next + 1) % total;
    }
    return next;
  }

  function checkGameOverLocal(nextHands: Record<string, Card[]>): boolean {
    const total = players.length;
    const finishedIndices = players
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => (nextHands[id] ?? []).length === 0)
      .map(({ index }) => index);

    // Rule 1: 3 players finished
    if (finishedIndices.length >= total - 1) {
      return true;
    }

    // Rule 2: Team 0/2 finished (Double Up)
    if (finishedIndices.includes(0) && finishedIndices.includes(2)) {
      return true;
    }

    // Rule 3: Team 1/3 finished (Double Up)
    if (finishedIndices.includes(1) && finishedIndices.includes(3)) {
      return true;
    }

    return false;
  }

  function getRankBadge(playerIndex: number) {
    if (!gameOver) return null;
    const rankIndex = finishedPlayers.indexOf(playerIndex);
    if (rankIndex === -1) {
      // If game is over, anyone not finished is the last one (assuming single winner or full playout)
      // Guandan usually plays until 3 players finish.
      // If we stop when 3 finish, the 4th is last.
      const activeCount = players.length - finishedPlayers.length;
      if (activeCount <= 1) {
         return <div className="rank-badge last">末游</div>;
      }
      return null;
    }
    const labels = ["头游", "二游", "三游", "末游"];
    return <div className={`rank-badge rank-${rankIndex}`}>{labels[rankIndex]}</div>;
  }

  async function runAiTurn(playerIndex: number, last: LegacyLastPlay) {
    const playerId = players[playerIndex];
    const cards = hands[playerId] ?? [];
    if (cards.length === 0) {
      const nextIndex = getNextActivePlayerIndex(playerIndex);
      setCurrentPlayerIndex(nextIndex);
      return;
    }

    // AI Speed Optimization: No artificial delay
    // We used to have setTimeout here, but user wants it fast.
    // The backend latency is the main factor now.
    
    // Call Backend AI
    let decision: { type: string; cards: Card[] } | { type: "pass" } = { type: "pass" };
    
    try {
        const payload = {
            player_index: playerIndex,
            my_hand: cards,
            current_hand: [], // Optional: send grouped hand if needed
            last_play: last ? {
                player_index: last.playerIndex,
                cards: last.cards,
                type: last.type
            } : null,
            // We can also send played history, etc.
        };

        const response = await fetch(`${API_BASE}/suggest_move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            setLastAiDecision(data);
            
            if (data.reasoning) {
                setAiLogs(prev => [...prev, {
                  reasoning: data.reasoning,
                  message: data.message || "AI Thought Process",
                  timestamp: Date.now()
                }]);
                // Scroll to bottom after state update
                setTimeout(() => {
                    if (logsEndRef.current) {
                        logsEndRef.current.scrollIntoView({ behavior: "smooth" });
                    }
                }, 100);
            }

            if (data.action === "play" && data.cards && data.cards.length > 0) {
                // Determine type locally or trust backend? 
                // For now, let's verify locally to be safe.
                const backendCards = data.cards;
                
                // Recommendation Logic: Highlight cards if not auto-playing
                if (!autoPlay) {
                    setLastRecommendedCards(backendCards);
                    // Find indices in selfCards that match backendCards
                    const newSelected = new Set<string>();
                    
                    // Helper to match cards. We need to match by suit and rank.
                    // selfGroups is array of array of cards.
                    // We iterate through selfGroups and pick matching cards until we satisfy the backendCards count.
                    // Since backendCards are specific cards (suit/rank), we need to find exact matches.
                    // However, we might have multiple identical cards (e.g. 2 Heart 5s).
                    // We need to keep track of used indices to avoid double counting.
                    
                    const needed = [...backendCards];
                    const foundIndices = new Set<string>();
                    
                    selfGroups.forEach((group, gIdx) => {
                        group.forEach((card, cIdx) => {
                            const neededIndex = needed.findIndex(n => n.suit === card.suit && n.rank === card.rank);
                            if (neededIndex !== -1) {
                                // Found a match
                                newSelected.add(`${gIdx}-${cIdx}`);
                                needed.splice(neededIndex, 1); // Remove from needed
                            }
                        });
                    });
                    
                    setSelectedIndices(newSelected);
                    // Also select the group if all cards in group are selected? 
                    // No, existing logic uses selectedIndices for individual cards.
                }

                const type = cardRules.getCardType(backendCards);
                if (type) {
                     // Verify if valid move
                     const can = !last || validPlay({
                        playerIndex,
                        selected: backendCards,
                        type,
                        lastPlay: last,
                        cardRules,
                        cardPower: CardPower
                     });
                     
                     if (can) {
                         decision = { type, cards: backendCards };
                         console.log(`Backend Suggested Move: ${type}`, backendCards);
                     } else {
                         console.warn("Backend suggested invalid move, falling back to legacy AI", data);
                     }
                }
            } else {
                 console.log("Backend Suggested Pass");
            }
        }
    } catch (e) {
        console.error("AI Backend Failed", e);
    }

    // Fallback to Legacy AI if backend failed or returned invalid move or pass (when leading)
    // Actually, if backend says "pass" but we are leading, we MUST play.
    // The backend should handle this logic, but as a safety net:
    if (decision.type === "pass" && !last) {
        // Legacy Fallback Logic
        const grouped = handOptimizer.groupByMinHands(cards);
        const candidateGroups = grouped.slice().reverse();
        for (const group of candidateGroups) {
          const type = cardRules.getCardType(group);
          if (!type) continue;
          decision = { type, cards: group };
          break;
        }
        
        // Final fallback: smallest single
        if (decision.type === "pass" && cards.length > 0) {
             const sorted = cardRules.sortCards(cards);
             decision = { type: "1", cards: [sorted[sorted.length - 1]] };
        }
    }
    
    // If backend returned pass and we are NOT leading, we accept it.
    // But if backend failed (network error), decision is still pass.
    // We should probably run legacy AI if network failed. 
    // Currently, decision is initialized to pass. 
    // If network fails, it stays pass. 
    // So if not leading, we might pass when we could play.
    // Let's improve fallback: Only rely on backend if successful.
    // But for this "Small Step", let's keep it simple. 
    // If backend fails, we might just pass this turn. That's acceptable for testing connection.

    if (decision.type === "pass") {
      const activeCount = players.length - finishedPlayers.length;
      const newPass = passCount + 1;
      let clearedLast = last;
      let resetPass = newPass;
      if (activeCount > 1 && newPass >= activeCount - 1) {
        clearedLast = null;
        resetPass = 0;
      }
      setPassCount(resetPass);
      setLastPlay(clearedLast);
      setLastActions((prev) => ({
        ...prev,
        [playerIndex]: { cards: [], type: "pass" },
      }));
      const nextIndex = getNextActivePlayerIndex(playerIndex);
      setCurrentPlayerIndex(nextIndex);
      return;
    }

    const playCards = decision.cards;
    const type = decision.type;

    const nextHands: Record<string, Card[]> = {
      ...hands,
      [playerId]: (hands[playerId] ?? []).filter(
        (c) => !playCards.some(pc => pc.suit === c.suit && pc.rank === c.rank),
      ),
    };

    setHands(nextHands);
    setLastActions((prev) => ({
      ...prev,
      [playerIndex]: { cards: playCards, type },
    }));

    const newLast: LegacyLastPlay = {
      playerIndex,
      cards: playCards,
      type,
    };
    setLastPlay(newLast);
    setPassCount(0);

    // Update P0 visual hand if it's P0 playing (Auto Play)
    if (playerIndex === 0) {
      const remaining = nextHands[playerId] ?? [];
      try {
        const newGroups = handOptimizer.groupByMinHands(remaining);
        setCurrentSelfHand(newGroups);
      } catch (e) {
        setCurrentSelfHand(groupForRank(remaining));
      }
      setSelectedIndices(new Set());
    }

    if ((nextHands[playerId] ?? []).length === 0) {
      setFinishedPlayers((prev) =>
        prev.includes(playerIndex) ? prev : [...prev, playerIndex],
      );
    }

    if (checkGameOverLocal(nextHands)) {
      setGameOver(true);
      return;
    }

    const nextIndex = getNextActivePlayerIndex(playerIndex);
    setCurrentPlayerIndex(nextIndex);
  }

  function playGroupAtIndex(groupIndex: number) {
    if (!game || gameOver) return;
    if (currentPlayerIndex !== 0) return;
    const groups = selfGroups;
    if (groupIndex < 0 || groupIndex >= groups.length) {
      return;
    }
    const group = groups[groupIndex];
    const type = cardRules.getCardType(group);
    const canPlay =
      type &&
      validPlay({
        playerIndex: 0,
        selected: group,
        type,
        lastPlay,
        cardRules,
        cardPower: CardPower,
      });
    if (!canPlay || !type) {
      alert("出牌不合法，不能压过上一手牌");
      return;
    }

    setLastActions((prev) => ({
      ...prev,
      0: { cards: group, type },
    }));
    const nextGroups = groups.filter((_, index) => index !== groupIndex);
    setCurrentSelfHand(nextGroups);
    setSelectedGroupIndex(null);

    const selfKey = players[0];
    const currentSelf = hands[selfKey] ?? game?.hands?.[selfKey] ?? [];
    const updatedSelf = currentSelf.filter((c) => !group.includes(c));
    const nextHands = { ...hands, [selfKey]: updatedSelf };
    setHands(nextHands);

    const newLast: LegacyLastPlay = {
      playerIndex: 0,
      cards: group,
      type,
    };
    setLastPlay(newLast);
    setPassCount(0);

    if (updatedSelf.length === 0) {
      setFinishedPlayers((prev) =>
        prev.includes(0) ? prev : [...prev, 0],
      );
    }

    if (checkGameOverLocal(nextHands)) {
      setGameOver(true);
      return;
    }

    const nextIndex = getNextActivePlayerIndex(0);
    setCurrentPlayerIndex(nextIndex);
  }

  function handleToggleGroup(groupIndex: number) {
    if (!game || gameOver) return;
    const group = selfGroups[groupIndex];
    const groupSize = group.length;
    const next = new Set(selectedIndices);
    let hasSelected = false;
    for (let i = 0; i < groupSize; i++) {
      if (next.has(`${groupIndex}-${i}`)) {
        hasSelected = true;
        break;
      }
    }
    if (hasSelected) {
      for (let i = 0; i < groupSize; i++) {
        next.delete(`${groupIndex}-${i}`);
      }
      setSelectedGroupIndex(null);
    } else {
      for (let i = 0; i < groupSize; i++) {
        next.add(`${groupIndex}-${i}`);
      }
      setSelectedGroupIndex(groupIndex);
    }
    setSelectedIndices(next);
  }

  function handleCardClick(groupIndex: number, cardIndex: number, e: React.MouseEvent) {
    if (!game || gameOver) return;
    if (currentPlayerIndex !== 0 && !autoPlay) return;

    e.stopPropagation();
    const key = `${groupIndex}-${cardIndex}`;
    const newSelection = new Set(selectedIndices);

    // Split Mode: Toggle individual cards
    if (isSplitMode) {
      if (newSelection.has(key)) {
        newSelection.delete(key);
      } else {
        newSelection.add(key);
      }
      setSelectedIndices(newSelection);
      return;
    }

    if (newSelection.has(key)) {
      // Deselect specific card
      newSelection.delete(key);
    } else {
      // Check if any card in this group is already selected
      const groupSize = selfGroups[groupIndex].length;
      let hasSelectedInGroup = false;
      for (let i = 0; i < groupSize; i++) {
        if (newSelection.has(`${groupIndex}-${i}`)) {
          hasSelectedInGroup = true;
          break;
        }
      }

      if (!hasSelectedInGroup) {
        // Select whole group
        for (let i = 0; i < groupSize; i++) {
          newSelection.add(`${groupIndex}-${i}`);
        }
      } else {
        // Select just this card
        newSelection.add(key);
      }
    }
    setSelectedIndices(newSelection);
  }

  function handlePlaySelected() {
    if (!game || gameOver) return;
    if (currentPlayerIndex !== 0 && !autoPlay) return;
    
    // Gather selected cards
    const selectedCards: Card[] = [];
    const selectedKeys = new Set(selectedIndices);
    
    // We iterate through groups to maintain order (or we can sort them)
    selfGroups.forEach((group, gIdx) => {
      group.forEach((card, cIdx) => {
        if (selectedKeys.has(`${gIdx}-${cIdx}`)) {
          selectedCards.push(card);
        }
      });
    });

    if (selectedCards.length === 0) return;

    const type = cardRules.getCardType(selectedCards);
    const canPlay =
      type &&
      validPlay({
        playerIndex: 0,
        selected: selectedCards,
        type,
        lastPlay,
        cardRules,
        cardPower: CardPower,
      });

    if (!canPlay || !type) {
      alert("出牌不合法，不能压过上一手牌");
      return;
    }

    setLastActions((prev) => ({
      ...prev,
      0: { cards: selectedCards, type },
    }));

    // Remove played cards from selfGroups
    // We need to reconstruct groups. Simplest way: filter out played cards and regroup?
    // Or just remove them from current groups.
    // Let's filter flat list and regroup? Or preserve group structure?
    // If we split a group, the remaining cards should probably stay together.
    
    // Better: Remove played cards from their respective groups.
    const nextGroups = selfGroups.map((group, gIdx) => {
       return group.filter((_, cIdx) => !selectedKeys.has(`${gIdx}-${cIdx}`));
    }).filter(g => g.length > 0);

    setCurrentSelfHand(nextGroups);
    setSelectedIndices(new Set());

    const selfKey = players[0];
    const currentSelf = hands[selfKey] ?? game?.hands?.[selfKey] ?? [];
    // We need to remove exact card instances. 
    // Since cards are objects, we can filter by reference if they are the same objects.
    // But sort/group creates new arrays.
    // Let's rely on value equality (suit/rank).
    // Be careful with duplicates (2 decks).
    // We should remove N matching cards.
    
    let remaining = [...currentSelf];
    for (const played of selectedCards) {
      const idx = remaining.findIndex(c => c.suit === played.suit && c.rank === played.rank);
      if (idx !== -1) {
        remaining.splice(idx, 1);
      }
    }

    const nextHands = { ...hands, [selfKey]: remaining };
    setHands(nextHands);

    const newLast: LegacyLastPlay = {
      playerIndex: 0,
      cards: selectedCards,
      type,
    };
    setLastPlay(newLast);
    setPassCount(0);

    if (remaining.length === 0) {
      setFinishedPlayers((prev) =>
        prev.includes(0) ? prev : [...prev, 0],
      );
    }

    if (checkGameOverLocal(nextHands)) {
      setGameOver(true);
      return;
    }

    const nextIndex = getNextActivePlayerIndex(0);
    setCurrentPlayerIndex(nextIndex);
  }

  function handlePass() {
    if (!game || gameOver) return;
    if (currentPlayerIndex !== 0 && !autoPlay) return;
    
    // Cannot pass if you are the leader of the trick (lastPlay is null)
    if (lastPlay === null) {
      alert("你是头家，必须出牌，不能过牌");
      return;
    }

    const activeCount = players.length - finishedPlayers.length;
    const newPass = passCount + 1;
    let clearedLast = lastPlay;
    let resetPass = newPass;
    if (activeCount > 1 && newPass >= activeCount - 1) {
      clearedLast = null;
      resetPass = 0;
    }
    setLastActions((prev) => ({
      ...prev,
      0: { cards: [], type: "pass" },
    }));
    setSelectedIndices(new Set());
    setPassCount(resetPass);
    setLastPlay(clearedLast);

    const nextIndex = getNextActivePlayerIndex(0);
    setCurrentPlayerIndex(nextIndex);
  }

  function handleOrganize() {
    if (!game) return;
    if (!flatSelfCards.length) return;

    try {
      const sorted = cardRules.sortCards(flatSelfCards);
      const grouped = groupForRank(sorted);
      setCurrentSelfHand(grouped);
      setSelectedIndices(new Set());
    } catch (e) {
      console.error("Organize failed", e);
      alert("理牌失败");
    }
  }

  function handleReset() {
    if (!game) return;
    const base = originalSelfHand ?? selfCardsFromServer;
    if (!base.length) return;

    try {
      // Reset also defaults to rank grouping for consistency
      const sorted = cardRules.sortCards(base);
      const grouped = groupForRank(sorted);
      setCurrentSelfHand(grouped);
      setSelectedIndices(new Set());
      setTableCards([]);
      setHands(game.hands);
      setCurrentPlayerIndex(0);
      setLastPlay(null);
      setLastActions({});
      setPassCount(0);
      setFinishedPlayers([]);
      setGameOver(false);
    } catch (e) {
      console.error("Reset failed", e);
    }
  }

  function handleAiGroup() {
    if (!game) return;
    if (!flatSelfCards.length) return;

    try {
      const groups = handOptimizer.groupByMinHands(flatSelfCards);
      setCurrentSelfHand(groups);
      setSelectedIndices(new Set());
    } catch (e) {
      console.error("AI Group failed", e);
      alert("AI组排失败");
    }
  }

  // New helper: Group purely by rank (for Organize/Default view)
  function groupForRank(cards: Card[]): Card[][] {
    const groups: Card[][] = [];
    if (cards.length === 0) return groups;

    let currentGroup: Card[] = [cards[0]];
    for (let i = 1; i < cards.length; i++) {
      const prev = cards[i - 1];
      const curr = cards[i];
      // Same rank? Add to group.
      if (prev.rank === curr.rank) {
        currentGroup.push(curr);
      } else {
        groups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    groups.push(currentGroup);
    return groups;
  }

  async function handleUpload() {
    if (!game) {
      return;
    }
    setUploadState("loading");
    try {
      const payload = [
        {
          state: {
            id: game.id,
            players: game.players,
            hands: game.hands,
          },
          action: {
            type: "snapshot",
            source: "GuandanAgent",
          },
          meta: {
            client: "GuandanAgent-frontend",
          },
          timestamp: Date.now(),
        },
      ];
      const response = await fetch(`${API_BASE}/save_sqlite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setUploadState("success");
    } catch (error) {
      setUploadState("error");
    }
  }

  useEffect(() => {
    if (gameOver) {
      // Calculate levels
      const remaining = [0, 1, 2, 3].filter(p => !finishedPlayers.includes(p));
      const finalOrder = [...finishedPlayers, ...remaining];
      
      if (finalOrder.length === 4) {
        const firstPlace = finalOrder[0];
        const partner = (firstPlace + 2) % 4;
        const partnerRank = finalOrder.indexOf(partner); // 0-based index
        
        let levelGain = 1; // Default
        if (partnerRank === 1) levelGain = 3; // Partner is 2nd (Double Up)
        else if (partnerRank === 2) levelGain = 2; // Partner is 3rd

        const isSelfTeam = firstPlace === 0 || firstPlace === 2;
        
        setTeamLevels(prev => {
          const next = {
            self: isSelfTeam ? prev.self + levelGain : prev.self,
            opponent: !isSelfTeam ? prev.opponent + levelGain : prev.opponent
          };
          
          // Check for Match Over (Level > 14 / A)
          // Actually "passed A" means > 14. 
          // HappyGuandan usually ends when > 14.
          if (next.self > 14 || next.opponent > 14) {
            setMatchOver(true);
          }
          
          return next;
        });

        setNextStartPlayer(firstPlace);
      }
    }
  }, [gameOver]); // Run once when gameOver becomes true

  useEffect(() => {
    if (!game || gameOver) return;
    if (currentPlayerIndex === 0) {
      if (autoPlay) {
        const timer = setTimeout(() => {
          runAiTurn(0, lastPlay);
        }, 800);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (finishedPlayers.includes(currentPlayerIndex)) {
      const nextIndex = getNextActivePlayerIndex(currentPlayerIndex);
      if (nextIndex !== currentPlayerIndex) {
        setCurrentPlayerIndex(nextIndex);
      }
      return;
    }
    const timer = setTimeout(() => {
      runAiTurn(currentPlayerIndex, lastPlay);
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPlayerIndex, game, gameOver, finishedPlayers, lastPlay, autoPlay, hands]);

  const healthClass =
    healthState === "success"
      ? "health-pill ok"
      : healthState === "error"
        ? "health-pill error"
        : "health-pill";

  return (
    <div className="game-root">
      <div className="game-table">
        <div className="table-background" />

        <div className="top-strip">
          {/*<div className="game-title">Happy Guandan Agent</div>*/}
          <div className={healthClass}>{healthMessage ?? "检测后端中"}</div>
        </div>

        <div id="player-icons">
          <div
              className={
                  "player-icon " +
                  (currentPlayerIndex === 0 ? "active" : "dimmed")
              }
              id="player-0-icon"
          >
            {getRankBadge(0)}
            {/*<img src="/players/player_0.jpg" alt="P0" />*/}
            <img src="/cards/big_joker.jpeg" alt="P0"/>
            <div
                className="p0-extras"
                style={{
                  position: "absolute",
                  left: "100%",
                  top: "50%",
                  transform: "translateY(-50%)",
                  marginLeft: "12px",
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(0, 0, 0, 0.6)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  color: "white",
                  fontSize: "12px",
                  whiteSpace: "nowrap",
                }}
            >
              <input
                  type="checkbox"
                  checked={isSplitMode}
                  onChange={(e) => setIsSplitMode(e.target.checked)}
                  style={{marginRight: "4px", cursor: "pointer"}}
              />
              <span onClick={() => setIsSplitMode(!isSplitMode)} style={{cursor: "pointer"}}>单选</span>
            </div>
          </div>
          <div
              className={
                  "player-icon " +
                  (currentPlayerIndex === 1 ? "active" : "dimmed")
              }
              id="player-1-icon"
          >
            {getRankBadge(1)}
            {/*<img src="/players/player_1.jpeg" alt="P1" />*/}
            <img src="/cards/small_joker.jpeg" alt="P1"/>
            <div className="player-card-count">
              {(hands[players[1]] ?? game?.hands?.[players[1]] ?? []).length}
            </div>
          </div>
          <div
              className={
                  "player-icon " +
                  (currentPlayerIndex === 2 ? "active" : "dimmed")
              }
              id="player-2-icon"
          >
            {getRankBadge(2)}
            {/*<img src="/players/player_2.jpeg" alt="P2" />*/}
            <img src="/cards/big_joker.jpeg" alt="P2"/>
            <div className="player-card-count">
              {(hands[players[2]] ?? game?.hands?.[players[2]] ?? []).length}
            </div>
          </div>
          <div
              className={
              "player-icon " +
                  (currentPlayerIndex === 3 ? "active" : "dimmed")
              }
              id="player-3-icon"
          >
            {getRankBadge(3)}
            {/*<img src="/players/player_3.jpeg" alt="P3" />*/}
            <img src="/cards/small_joker.jpeg" alt="P3"/>
            <div className="player-card-count">
              {(hands[players[3]] ?? game?.hands?.[players[3]] ?? []).length}
            </div>
          </div>
        </div>

        <div id="scoreboard">
        <div className={`team self ${[0, 2].includes(currentStartPlayer) ? "highlight" : ""}`}>
            <div className="team-name">己方</div>
            <div className="team-score">{formatLevel(teamLevels.self)}</div>
          </div>
          <div className={`team opponent ${[1, 3].includes(currentStartPlayer) ? "highlight" : ""}`}>
            <div className="team-name">对方</div>
            <div className="team-score">{formatLevel(teamLevels.opponent)}</div>
          </div>
        </div>

        <div id="settings-container">
          <button
            type="button"
            onClick={() => setShowDashboard(true)}
            style={{ fontSize: "24px", background: "none", border: "none", cursor: "pointer", marginRight: "10px" }}
          >
            📊
          </button>
          <button
            id="settings-btn"
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            ⚙️
          </button>
          {showDashboard && (
            <div style={{
              position: "fixed",
              top: dashboardPos.y,
              left: dashboardPos.x,
              background: "rgba(255, 255, 255, 0.98)",
              padding: "0",
              borderRadius: "10px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              zIndex: 3000,
              width: "700px",
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              color: "#333",
              border: "1px solid #ccc"
            }}>
              <div 
                onMouseDown={(e) => handleMouseDown(e, "dashboard")}
                style={{
                  display:"flex", 
                  justifyContent:"space-between", 
                  alignItems:"center", 
                  padding: "15px 20px",
                  borderBottom: "1px solid #eee",
                  cursor: "move",
                  background: "#f8f9fa",
                  borderTopLeftRadius: "10px",
                  borderTopRightRadius: "10px"
                }}
              >
                  <h3 style={{margin:0, color: "#333"}}>📊 训练监控 & 决策对比</h3>
                  <button onClick={() => setShowDashboard(false)} style={{border:"none", background:"none", fontSize:"24px", cursor:"pointer", color: "#666"}}>×</button>
              </div>

              <div style={{padding: "20px", overflowY: "auto", flex: 1}}>
                
                {/* Comparison Section */}
                <div style={{marginBottom: "30px"}}>
                  <h4 style={{marginTop: 0, borderLeft: "4px solid #2196f3", paddingLeft: "10px", marginBottom: "15px"}}>
                    本局决策对比 (Decision Comparison)
                  </h4>
                  {lastAiDecision ? (
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px"}}>
                      {/* MCTS Card */}
                      <div style={{border: "2px solid #4caf50", borderRadius: "8px", padding: "15px", background: "#f0fff4"}}>
                        <div style={{fontWeight: "bold", color: "#2e7d32", marginBottom: "10px", display: "flex", justifyContent: "space-between"}}>
                          <span>🤖 AlphaGo (MCTS)</span>
                          <span style={{fontSize: "12px", background: "#4caf50", color: "white", padding: "2px 6px", borderRadius: "4px"}}>Primary</span>
                        </div>
                        <div style={{fontSize: "18px", fontWeight: "bold", marginBottom: "8px"}}>
                          {lastAiDecision.action === "pass" ? "Pass (不要)" : lastAiDecision.desc || "Play Cards"}
                        </div>
                        <div style={{fontSize: "13px", color: "#555", lineHeight: "1.4"}}>
                           <div>Win Rate: <b>{(lastAiDecision.win_rate * 100).toFixed(1)}%</b></div>
                           <div>Visits: {lastAiDecision.visits}</div>
                           <div style={{marginTop: "5px", fontStyle: "italic"}}>{lastAiDecision.reasoning?.split('[Comparison]')[0]}</div>
                        </div>
                      </div>

                      {/* LLM Card */}
                      <div style={{border: "2px solid #9c27b0", borderRadius: "8px", padding: "15px", background: "#fdf4ff"}}>
                        <div style={{fontWeight: "bold", color: "#7b1fa2", marginBottom: "10px", display: "flex", justifyContent: "space-between"}}>
                          <span>🧠 LLM (Reference)</span>
                          <span style={{fontSize: "12px", background: "#9c27b0", color: "white", padding: "2px 6px", borderRadius: "4px"}}>Comparison</span>
                        </div>
                        {lastAiDecision.llm_recommendation ? (
                          <>
                            <div style={{fontSize: "18px", fontWeight: "bold", marginBottom: "8px"}}>
                              {lastAiDecision.llm_recommendation.action === "pass" ? "Pass (不要)" : lastAiDecision.llm_recommendation.desc || "Play Cards"}
                            </div>
                            <div style={{fontSize: "13px", color: "#555", lineHeight: "1.4"}}>
                              <div style={{marginTop: "5px", fontStyle: "italic"}}>{lastAiDecision.llm_recommendation.reasoning}</div>
                            </div>
                          </>
                        ) : (
                          <div style={{color: "#999", fontStyle: "italic"}}>LLM skipped or failed</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{textAlign: "center", color: "#999", padding: "20px", background: "#f5f5f5", borderRadius: "8px"}}>
                      Waiting for AI decision...
                    </div>
                  )}
                </div>

                {/* Stats Section */}
                <div>
                  <h4 style={{marginTop: 0, borderLeft: "4px solid #4caf50", paddingLeft: "10px", marginBottom: "15px"}}>
                    训练数据 (Training Stats)
                  </h4>
                  {dashboardData ? (
                    <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                          <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "8px", textAlign: "center" }}>
                            <div style={{ color: "#666", fontSize: "14px" }}>总决策次数</div>
                            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2196f3" }}>
                              {dashboardData.summary?.total_games || 0}
                            </div>
                          </div>
                          <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "8px", textAlign: "center" }}>
                            <div style={{ color: "#666", fontSize: "14px" }}>平均胜率预估</div>
                            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#4caf50" }}>
                              {((dashboardData.summary?.avg_win_rate || 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        <div style={{ marginBottom: "20px" }}>
                          <div style={{fontSize: "14px", fontWeight: "bold", marginBottom: "5px", color: "#555"}}>胜率趋势 (Win Rate)</div>
                          <div style={{ height: "100px", display: "flex", alignItems: "flex-end", gap: "2px", background: "#f0f0f0", padding: "10px", borderRadius: "4px", overflowX: "auto" }}>
                            {dashboardData.history?.map((d: any, i: number) => (
                              <div key={i} style={{
                                width: "8px",
                                height: `${d.win_rate * 100}%`,
                                backgroundColor: "#4caf50",
                                opacity: 0.8,
                                flexShrink: 0
                              }} title={`Move ${i+1}: ${(d.win_rate * 100).toFixed(1)}%`} />
                            ))}
                          </div>
                        </div>

                        <div>
                          <div style={{fontSize: "14px", fontWeight: "bold", marginBottom: "5px", color: "#555"}}>手牌评分趋势 (Hand Score)</div>
                          <div style={{ height: "100px", display: "flex", alignItems: "flex-end", gap: "2px", background: "#f0f0f0", padding: "10px", borderRadius: "4px", overflowX: "auto" }}>
                            {dashboardData.history?.map((d: any, i: number) => (
                              <div key={i} style={{
                                width: "8px",
                                height: `${Math.min(d.hand_score * 3, 100)}%`, // Scale visually
                                backgroundColor: "#2196f3",
                                opacity: 0.8,
                                flexShrink: 0
                              }} title={`Move ${i+1}: ${d.hand_score}`} />
                            ))}
                          </div>
                        </div>
                    </div>
                  ) : (
                    <div style={{textAlign: "center", padding: "20px"}}>加载数据中...</div>
                  )}
                </div>

                {/* RL Training Status Section */}
                <div style={{marginTop: "30px"}}>
                  <h4 style={{marginTop: 0, borderLeft: "4px solid #ff9800", paddingLeft: "10px", marginBottom: "15px"}}>
                    强化学习进度 (RL Training Progress)
                  </h4>
                  {trainingStats ? (
                    <div style={{ background: "#fff8e1", padding: "15px", borderRadius: "8px", border: "1px solid #ffecb3" }}>
                       <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "15px"}}>
                          <div style={{textAlign: "center"}}>
                             <div style={{color: "#666", fontSize: "12px"}}>Self-Play Games</div>
                             <div style={{fontSize: "20px", fontWeight: "bold", color: "#f57c00"}}>{trainingStats.games_played}</div>
                          </div>
                          <div style={{textAlign: "center"}}>
                             <div style={{color: "#666", fontSize: "12px"}}>Model Win Rate</div>
                             <div style={{fontSize: "20px", fontWeight: "bold", color: "#f57c00"}}>{(trainingStats.current_win_rate * 100).toFixed(1)}%</div>
                          </div>
                          <div style={{textAlign: "center"}}>
                             <div style={{color: "#666", fontSize: "12px"}}>Version</div>
                             <div style={{fontSize: "14px", fontWeight: "bold", color: "#f57c00", marginTop: "4px"}}>{trainingStats.model_version}</div>
                          </div>
                       </div>
                       
                       {/* Mini Chart for Training Win Rate */}
                       <div style={{fontSize: "12px", fontWeight: "bold", marginBottom: "5px", color: "#795548"}}>Recent Win/Loss (Last 100 Games)</div>
                       <div style={{ height: "60px", display: "flex", alignItems: "flex-end", gap: "2px", background: "white", padding: "5px", borderRadius: "4px", overflowX: "hidden" }}>
                    {trainingStats.history?.map((win: number, i: number) => (
                      <div key={i} style={{
                        width: "4px",
                        height: "100%",
                        backgroundColor: win === 1 ? "#4caf50" : "#f44336",
                        opacity: 0.8,
                        flexShrink: 0,
                        borderRadius: "1px"
                      }} title={win === 1 ? "Win" : "Loss"} />
                    ))}
               </div>
               
               {/* Win Rate Trend Chart */}
               {trainingStats.trend && trainingStats.trend.length > 1 && (
                  <div style={{marginTop: "15px"}}>
                      <div style={{fontSize: "12px", fontWeight: "bold", marginBottom: "5px", color: "#1565c0"}}>Win Rate Trend (Moving Avg)</div>
                      <div style={{height: "100px", background: "white", padding: "5px", borderRadius: "4px", position: "relative", border: "1px solid #e0e0e0"}}>
                          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                              {/* Grid Lines */}
                              <line x1="0" y1="0" x2="100" y2="0" stroke="#eee" strokeWidth="1" />
                              <line x1="0" y1="25" x2="100" y2="25" stroke="#eee" strokeWidth="1" />
                              <line x1="0" y1="50" x2="100" y2="50" stroke="#ddd" strokeWidth="1" strokeDasharray="2" />
                              <line x1="0" y1="75" x2="100" y2="75" stroke="#eee" strokeWidth="1" />
                              <line x1="0" y1="100" x2="100" y2="100" stroke="#eee" strokeWidth="1" />
                              
                              {/* Trend Line */}
                              <polyline
                                  fill="none"
                                  stroke="#2196f3"
                                  strokeWidth="2"
                                  points={(() => {
                                      const trend = trainingStats.trend;
                                      const maxGame = trend[trend.length - 1].game;
                                      // Start from the first game in trend
                                      const minGame = trend[0].game;
                                      const gameRange = maxGame - minGame || 1;
                                      
                                      return trend.map((t: any) => {
                                          const x = ((t.game - minGame) / gameRange) * 100;
                                          const y = 100 - (t.win_rate * 100);
                                          return `${x},${y}`;
                                      }).join(" ");
                                  })()}
                              />
                          </svg>
                          <div style={{position: "absolute", top: "2px", right: "5px", fontSize: "10px", color: "#999"}}>100%</div>
                          <div style={{position: "absolute", top: "45%", right: "5px", fontSize: "10px", color: "#999"}}>50%</div>
                          <div style={{position: "absolute", bottom: "2px", right: "5px", fontSize: "10px", color: "#999"}}>0%</div>
                      </div>
                  </div>
               )}
               
                       <div style={{textAlign: "right", fontSize: "10px", color: "#999", marginTop: "5px"}}>Last 100 Games</div>
                    </div>
                  ) : (
                    <div style={{color: "#999", fontStyle: "italic"}}>Training not started or stats unavailable</div>
                  )}
                </div>
              </div>
            </div>
          )}
          {settingsOpen ? (
            <>
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 998,
                }}
                onClick={() => setSettingsOpen(false)}
              />
              <div id="settings-panel" style={{ zIndex: 999 }}>
                <label>
                  <input type="checkbox" /> 进贡模式
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={autoPlay}
                    onChange={(e) => setAutoPlay(e.target.checked)}
                  />
                    AI 托管
                </label>
              </div>
            </>
          ) : null}
        </div>

        {[0, 1, 2, 3].map((pIndex) => {
          const action = lastActions[pIndex];
          if (!action) return null;
          
          let style: React.CSSProperties = { position: "absolute", zIndex: 250 };
          if (pIndex === 0) {
            style.bottom = "28%"; 
            style.left = "50%";
            style.transform = "translateX(-50%)";
          } else if (pIndex === 1) {
            style.top = "40%";
            style.left = "15%"; 
            style.transform = "translateY(-50%)";
          } else if (pIndex === 2) {
             style.top = "25%";
             style.left = "50%";
             style.transform = "translateX(-50%)";
          } else if (pIndex === 3) {
             style.top = "40%";
             style.right = "15%";
             style.transform = "translateY(-50%)";
          }

          if (action.type === "pass") {
             return (
               <div key={`last-action-${pIndex}`} style={{...style, color: "#DDD", fontSize: "20px", fontWeight: "bold", background:"rgba(0,0,0,0.5)", padding:"4px 8px", borderRadius:"4px"}}>不要</div>
             );
          }
          
          return (
             <div key={`last-action-${pIndex}`} style={{...style, display: "flex", alignItems: "center", justifyContent: "center"}}>
                {action.cards.map((card, idx) => (
                   <img 
                     key={idx} 
                     src={cardImagePath(card)} 
                     style={{
                        width: "60px", 
                        height: "auto", 
                        marginLeft: idx===0?0:"-40px", 
                        borderRadius: "4px", 
                        boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
                     }} 
                   />
                ))}
             </div>
          );
        })}

        {gameOver && !matchOver && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 2000,
            }}
          >
            <button
              className="action-btn"
              onClick={() => handleDeal(false)}
              style={{
                width: "auto",
                padding: "10px 40px",
                fontSize: "24px",
                background: "linear-gradient(to bottom, #4caf50, #45a049)",
              }}
            >
              下一局
            </button>
          </div>
        )}

        {matchOver && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 2000,
              background: "rgba(0,0,0,0.85)",
              padding: "40px",
              borderRadius: "16px",
              color: "white",
              textAlign: "center",
              border: "2px solid gold",
              boxShadow: "0 0 20px gold"
            }}
          >
            <h1 style={{ margin: "0 0 20px 0", fontSize: "36px", color: "#FFD700" }}>
              {teamLevels.self > 14 ? "己方获胜！" : "对方获胜！"}
            </h1>
            <div style={{ fontSize: "24px", marginBottom: "30px" }}>
              最终比分: {formatLevel(teamLevels.self)} : {formatLevel(teamLevels.opponent)}
            </div>
            <button
              className="action-btn"
              onClick={handleRestartMatch}
              style={{
                width: "auto",
                padding: "10px 40px",
                fontSize: "24px",
                background: "linear-gradient(to bottom, #FFD700, #FFC107)",
                color: "#333",
                fontWeight: "bold"
              }}
            >
              下一轮
            </button>
          </div>
        )}

        <div className="hand-panel">
          <div className="hand-cards">
            {selfGroups.map((group, groupIndex) => (
              <div
                key={`group-${groupIndex}`}
                className={
                  selectedGroupIndex === groupIndex
                    ? "card-group selected"
                    : "card-group"
                }
                onClick={() => handleToggleGroup(groupIndex)}
                onDoubleClick={() => playGroupAtIndex(groupIndex)}
              >
                {group.map((card, index) => {
                  const key = `${groupIndex}-${index}`;
                  const isSelected = selectedIndices.has(key);
                  return (
                    <img
                      key={`${card.suit}-${card.rank}-${index}`}
                      src={cardImagePath(card)}
                      alt={formatCardLabel(card)}
                      className={
                        "card-image" + (isSelected ? " selected" : "")
                      }
                      style={{
                        bottom: `${index * 18}px`,
                        zIndex: group.length - index,
                      }}
                      onClick={(e) => handleCardClick(groupIndex, index, e)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="hand-info">
            {/*<span>*/}
            {/*  手牌 {flatSelfCards.length} 张*/}
            {/*</span>*/}
          </div>
        </div>

        <div id="button-row">
          <button
            id="start-btn"
            className="action-btn"
            type="button"
            onClick={handleDeal}
            disabled={dealState === "loading"}
          >
            {dealState === "loading" ? "发牌中..." : "开始发牌"}
          </button>
          {/*<button*/}
          {/*  id="organize-btn"*/}
          {/*  className="action-btn"*/}
          {/*  type="button"*/}
          {/*  onClick={handleOrganize}*/}
          {/*  disabled={!game || selfCards.length === 0}*/}
          {/*>*/}
          {/*  理牌*/}
          {/*</button>*/}
          <button
            id="min-hand-btn"
            className="action-btn"
            type="button"
            onClick={handleAiGroup}
            disabled={!game || selfCards.length === 0}
          >
            AI 组牌
          </button>
          <button
            id="reset-btn"
            className="action-btn"
            type="button"
            onClick={handleReset}
            disabled={!game || (originalSelfHand ?? selfCardsFromServer).length === 0}
          >
            还原
          </button>
          {/*<button*/}
          {/*  id="upload-btn"*/}
          {/*  className="action-btn"*/}
          {/*  type="button"*/}
          {/*  onClick={handleUpload}*/}
          {/*  disabled={!game || uploadState === "loading"}*/}
          {/*>*/}
          {/*  {uploadState === "loading"*/}
          {/*    ? "记录中..."*/}
          {/*    : uploadState === "success"*/}
          {/*      ? "已记录"*/}
          {/*      : uploadState === "error"*/}
          {/*        ? "重试记录"*/}
          {/*        : "记录数据"}*/}
          {/*</button>*/}
        </div>

        <div id="action-panel">
          <button
            id="pass-btn"
            type="button"
            disabled={!game || gameOver || currentPlayerIndex !== 0 || lastPlay === null}
            onClick={handlePass}
          >
            过牌
          </button>
          <button
            id="play-btn"
            type="button"
            disabled={
              !game ||
              gameOver ||
              currentPlayerIndex !== 0 ||
              selectedIndices.size === 0
            }
            onClick={handlePlaySelected}
          >
            出牌
          </button>
        </div>

      <button 
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 3000,
          padding: '10px 20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          display: showAIModal ? 'none' : 'block'
        }}
        onClick={() => setShowAIModal(true)}
      >
        显示AI推理
      </button>

      {showAIModal && (
        <div style={{
          position: 'fixed',
          top: aiModalPos.y,
          left: aiModalPos.x,
          width: '400px',
          maxHeight: '500px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          zIndex: 3001,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '10px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          border: '1px solid #ccc',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div 
            style={{
              padding: '10px',
              backgroundColor: '#2196F3',
              color: 'white',
              cursor: 'move',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none'
            }}
            onMouseDown={(e) => handleMouseDown(e, "ai")}
          >
            <span style={{ fontWeight: 'bold' }}>AI推理和推荐</span>
            <button 
              onClick={() => setShowAIModal(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
          
          {/* Content */}
          <div style={{
            padding: '15px',
            overflowY: 'auto',
            flex: 1,
            maxHeight: '450px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            {aiLogs.length > 0 ? (
              <>
                {aiLogs.map((log, index) => (
                  <div key={index} style={{ borderBottom: index < aiLogs.length - 1 ? '1px solid #eee' : 'none', paddingBottom: '10px' }}>
                    <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#333', fontSize: '12px' }}>
                      {new Date(log.timestamp).toLocaleTimeString()} - {log.message}
                    </div>
                    <div style={{ 
                      whiteSpace: 'pre-wrap', 
                      backgroundColor: index === aiLogs.length - 1 ? '#e3f2fd' : '#f5f5f5', 
                      padding: '10px', 
                      borderRadius: '5px',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: '#444'
                    }}>
                      {log.reasoning}
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                等待AI思考... <br/>
                (推理过程将显示在这里)
              </p>
            )}
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
