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
  const [passCount, setPassCount] = useState(0);
  const [finishedPlayers, setFinishedPlayers] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);

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

  async function handleDeal() {
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
      const selfIdFromDeal = data.players[0];
      const selfHandFromDeal = data.hands?.[selfIdFromDeal] ?? [];
      setOriginalSelfHand(selfHandFromDeal);
      const sorted = cardRules.sortCards(selfHandFromDeal);
      const grouped = groupForRank(sorted);
      setCurrentSelfHand(grouped);
      setUploadState("idle");
      setDealState("success");
      setCurrentPlayerIndex(0);
      setLastPlay(null);
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
    const finished = players.filter((id) => (nextHands[id] ?? []).length === 0);
    if (finished.length >= total - 1) {
      return true;
    }
    return false;
  }

  function runAiTurn(playerIndex: number, last: LegacyLastPlay) {
    const playerId = players[playerIndex];
    const cards = hands[playerId] ?? [];
    if (cards.length === 0) {
      const nextIndex = getNextActivePlayerIndex(playerIndex);
      setCurrentPlayerIndex(nextIndex);
      return;
    }

    const grouped = handOptimizer.groupByMinHands(cards);
    let decision: { type: string; cards: Card[] } | { type: "pass" } = {
      type: "pass",
    };

    const candidateGroups = grouped.slice().reverse();

    for (const group of candidateGroups) {
      const type = cardRules.getCardType(group);
      if (!type) continue;
      const can =
        !last ||
        validPlay({
          playerIndex,
          selected: group,
          type,
          lastPlay: last,
          cardRules,
          cardPower: CardPower,
        });
      if (can) {
        decision = { type, cards: group };
        break;
      }
    }

    if (decision.type === "pass") {
      const activeCount = players.length - finishedPlayers.length;
      const newPass = passCount + 1;
      let clearedLast = last;
      let resetPass = newPass;
      if (activeCount > 1 && newPass >= activeCount - 1) {
        clearedLast = null;
        resetPass = 0;
        setTableCards([]);
      }
      setPassCount(resetPass);
      setLastPlay(clearedLast);
      const nextIndex = getNextActivePlayerIndex(playerIndex);
      setCurrentPlayerIndex(nextIndex);
      return;
    }

    const playCards = decision.cards;
    const type = decision.type;

    const nextHands: Record<string, Card[]> = {
      ...hands,
      [playerId]: (hands[playerId] ?? []).filter(
        (c) => !playCards.includes(c),
      ),
    };

    setHands(nextHands);
    setTableCards(playCards);
    const newLast: LegacyLastPlay = {
      playerIndex,
      cards: playCards,
      type,
    };
    setLastPlay(newLast);
    setPassCount(0);

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

    setTableCards(group);
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

    setTableCards(selectedCards);

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
    const activeCount = players.length - finishedPlayers.length;
    const newPass = passCount + 1;
    let clearedLast = lastPlay;
    let resetPass = newPass;
    if (activeCount > 1 && newPass >= activeCount - 1) {
      clearedLast = null;
      resetPass = 0;
      setTableCards([]);
    }
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
  }, [currentPlayerIndex, game, gameOver, finishedPlayers, lastPlay, autoPlay]);

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
          <div className="game-title">Happy Guandan Agent</div>
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
            <img src="/players/player_0.jpeg" alt="P0" />
            <div className="player-card-count">
              {(hands[players[0]] ?? game?.hands?.[players[0]] ?? []).length}
            </div>
          </div>
          <div
            className={
              "player-icon " +
              (currentPlayerIndex === 1 ? "active" : "dimmed")
            }
            id="player-1-icon"
          >
            <img src="/players/player_1.jpeg" alt="P1" />
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
            <img src="/players/player_2.jpeg" alt="P2" />
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
            <img src="/players/player_3.jpeg" alt="P3" />
            <div className="player-card-count">
              {(hands[players[3]] ?? game?.hands?.[players[3]] ?? []).length}
            </div>
          </div>
        </div>

        <div id="scoreboard">
          <div className="team self">
            <div className="team-name">己方</div>
            <div className="team-score">2</div>
          </div>
          <div className="team opponent">
            <div className="team-name">对方</div>
            <div className="team-score">2</div>
          </div>
        </div>

        <div id="settings-container">
          <button
            id="settings-btn"
            type="button"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            ⚙️
          </button>
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
                  托管 (Auto Play)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={isSplitMode}
                    onChange={(e) => setIsSplitMode(e.target.checked)}
                  />
                  拆牌模式 (Split Mode)
                </label>
              </div>
            </>
          ) : null}
        </div>

        {tableCards.length > 0 ? (
          <div className="table-play-area" style={tableCardsStyle}>
            {tableCards.map((card, index) => (
              <img
                key={`table-${card.suit}-${card.rank}-${index}`}
                src={cardImagePath(card)}
                alt={formatCardLabel(card)}
                className="card-image"
                style={{
                  position: "relative",
                  bottom: 0,
                  zIndex: index,
                  marginLeft: index === 0 ? 0 : -40,
                }}
              />
            ))}
          </div>
        ) : null}

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
            <span>
              手牌 {flatSelfCards.length} 张
            </span>
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
          <button
            id="organize-btn"
            className="action-btn"
            type="button"
            onClick={handleOrganize}
            disabled={!game || selfCards.length === 0}
          >
            理牌
          </button>
          <button
            id="min-hand-btn"
            className="action-btn"
            type="button"
            onClick={handleAiGroup}
            disabled={!game || selfCards.length === 0}
          >
            AI组牌
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
          <button
            id="upload-btn"
            className="action-btn"
            type="button"
            onClick={handleUpload}
            disabled={!game || uploadState === "loading"}
          >
            {uploadState === "loading"
              ? "记录中..."
              : uploadState === "success"
                ? "已记录"
                : uploadState === "error"
                  ? "重试记录"
                  : "记录数据"}
          </button>
        </div>

        <div id="action-panel">
          <button
            id="pass-btn"
            type="button"
            disabled={!game || gameOver || currentPlayerIndex !== 0}
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

        <div id="victory-overlay">
          <div id="victory-message">恭喜获胜</div>
          <button id="restart-match-btn" type="button">
            再来一局
          </button>
        </div>
      </div>
    </div>
  );
}
