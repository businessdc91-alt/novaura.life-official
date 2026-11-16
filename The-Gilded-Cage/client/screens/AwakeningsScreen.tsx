// AwakeningsScreen.tsx — The Echo Lattice table in the Brass Boiler Tavern:
// a quick game of Cognitive Awakenings: Echoes of a Soul against a patron,
// with an optional gold wager. Rules live in data/awakeningsEngine.ts.
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, ScrollView, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { GameColors, Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { OrnateButton } from "@/components/OrnateButton";
import { useGame } from "@/context/GameContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MINDS, MODES, ECHOES } from "@/data/awakeningsCards";
import { Match, MindCard, CELLS, createMatch, makeCard, randomMinds, placeCard, previewMove, choosePatronMove } from "@/data/awakeningsEngine";

interface AwakeningsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, "Awakenings">;
}

const SIDE_MARK = ["▲", "▶", "▼", "◀"];
const linkText = (links: boolean[]) => links.map((on, i) => (on ? SIDE_MARK[i] : "")).join("");

export default function AwakeningsScreen({ navigation }: AwakeningsScreenProps) {
  const insets = useSafeAreaInsets();
  const { gameState, addGold } = useGame();
  const [wager, setWager] = useState(25);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [collection, setCollection] = useState<MindCard[]>(() => randomMinds(8, 3).map(makeCard));
  const [settled, setSettled] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const stake = Math.min(wager, Math.max(0, gameState.hero.gold));

  const startDuel = () => {
    const mine = [...collection].sort(() => Math.random() - 0.5).slice(0, 5);
    const patron = randomMinds(5, 4, 2).map(makeCard);
    setMatch(createMatch(mine, patron));
    setSelected(null);
    setSettled(false);
    setClaimed(false);
  };
  useEffect(() => { startDuel(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The patron's turn.
  useEffect(() => {
    if (!match || match.phase !== "playing" || match.turn !== "red") return;
    const t = setTimeout(() => {
      const mv = choosePatronMove(match);
      if (mv) setMatch((m) => (m === match ? placeCard(m, "red", mv.handIdx, mv.cell) || m : m));
    }, 650);
    return () => clearTimeout(t);
  }, [match]);

  // Settle the wager once.
  useEffect(() => {
    if (!match || match.phase !== "over" || settled) return;
    setSettled(true);
    if (match.winner === "blue") addGold(stake);
    else if (match.winner === "red") addGold(-stake);
  }, [match, settled, stake, addGold]);

  const preview = useMemo(() => (match && selected != null && hover != null ? previewMove(match, "blue", selected, hover) : []), [match, selected, hover]);

  const pressCell = (cell: number) => {
    if (!match || match.turn !== "blue" || match.phase !== "playing" || selected == null) return;
    if (hover !== cell) { setHover(cell); return; } // first tap previews, second tap places
    const next = placeCard(match, "blue", selected, cell);
    if (next) { setMatch(next); setSelected(null); setHover(null); }
  };

  const claim = (card: MindCard) => {
    if (claimed) return;
    setCollection((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, makeCard(card)]));
    setClaimed(true);
  };

  const status = !match ? "" : match.phase === "over"
    ? match.winner === "blue" ? `You win${stake ? ` ${stake} gold` : ""}!` : match.winner === "red" ? `The patron wins${stake ? ` ${stake} gold` : ""}` : "A draw"
    : match.turn === "blue" ? (selected == null ? "Pick a card" : "Tap a square twice to place") : "Patron thinking…";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#1a1230", "#20180d", "#120d07"]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={GameColors.parchment} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Cognitive Awakenings · Echo Lattice</ThemedText>
          <ThemedText style={styles.subtitle}>Echoes of a Soul · {MINDS.length} AI minds · Gold: {gameState.hero.gold}</ThemedText>
        </View>
        <Pressable onPress={startDuel} style={styles.resetBtn}>
          <Feather name="refresh-cw" size={16} color={GameColors.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.wagerRow}>
          {[0, 25, 50, 100].map((amt) => (
            <Pressable key={amt} onPress={() => setWager(amt)} style={[styles.wagerChip, wager === amt && styles.wagerChipActive]}>
              <ThemedText style={styles.wagerText}>{amt === 0 ? "Friendly" : `${amt}g`}</ThemedText>
            </Pressable>
          ))}
        </View>

        {match ? (
          <>
            <View style={styles.scoreBar}>
              <ThemedText style={styles.blueText}>YOU {match.score.blue}</ThemedText>
              <ThemedText style={styles.statusText}>{status}</ThemedText>
              <ThemedText style={styles.redText}>PATRON {match.score.red}</ThemedText>
            </View>

            <View style={styles.board}>
              {Array.from({ length: CELLS }, (_, cell) => {
                const e = match.board[cell];
                const well = match.wells.includes(cell);
                return (
                  <Pressable key={cell} onPress={() => pressCell(cell)}
                    style={[styles.cell, well && styles.cellWell, e?.owner === "blue" && styles.cellBlue, e?.owner === "red" && styles.cellRed,
                      preview.includes(cell) && styles.cellPreview, hover === cell && !e && styles.cellHover]}>
                    {e ? (
                      <View style={styles.boardCardInner}>
                        <ThemedText style={styles.cardSignal}>{e.card.signal + e.boost + (well ? (e.card.echo === "surge" ? 3 : 1) : 0)}</ThemedText>
                        <ThemedText numberOfLines={1} style={styles.cardMiniName}>{MODES[e.card.mode].icon} {e.card.name}</ThemedText>
                        <ThemedText style={styles.cardLinks}>{linkText(e.card.links)} {ECHOES[e.card.echo].icon}</ThemedText>
                      </View>
                    ) : well ? <ThemedText style={styles.wellMark}>◈</ThemedText> : null}
                  </Pressable>
                );
              })}
            </View>

            <ThemedText style={styles.sectionHeading}>Your hand · Collection: {collection.length}</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.handScroll}>
              {match.hands.blue.map((card, i) => (
                <Pressable key={card.uid} disabled={card.used} onPress={() => { setSelected(i); setHover(null); }}
                  style={[styles.handCard, selected === i && styles.handCardActive, card.used && styles.handCardUsed]}>
                  <ThemedText style={styles.handSignal}>{card.signal}</ThemedText>
                  <ThemedText numberOfLines={1} style={styles.handName}>{card.name}</ThemedText>
                  <ThemedText style={styles.handMeta}>{MODES[card.mode].icon} {MODES[card.mode].label} · {card.year}</ThemedText>
                  <ThemedText style={styles.handLinks}>{linkText(card.links)}</ThemedText>
                  <ThemedText style={styles.handEcho}>{ECHOES[card.echo].icon} {ECHOES[card.echo].label}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {match.lastMove ? (
              <View style={styles.logBox}>
                <ThemedText style={styles.logLine}>
                  {match.lastMove.side === "blue" ? "You" : "The patron"} placed {match.lastMove.cardName}
                  {match.lastMove.captures.map((c) => ` · captured (${c.attack} vs ${c.defence})`).join("")}
                  {match.lastMove.ripples.length ? ` · ripple took ${match.lastMove.ripples.length} more` : ""}
                  {match.lastMove.chorus.length ? ` · chorus lifted ${match.lastMove.chorus.length}` : ""}
                </ThemedText>
              </View>
            ) : null}

            {match.phase === "over" ? (
              <View style={styles.resultBox}>
                {match.winner === "blue" && !claimed ? (
                  <>
                    <ThemedText style={styles.resultTitle}>Keep one of the patron's minds</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {match.hands.red.map((c) => (
                        <Pressable key={c.uid} onPress={() => claim(c)} style={styles.spoilCard}>
                          <ThemedText style={styles.handName}>{c.name}</ThemedText>
                          <ThemedText style={styles.handMeta}>{MODES[c.mode].icon} Signal {c.signal}</ThemedText>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}
                <OrnateButton onPress={startDuel}>Deal a new hand</OrnateButton>
              </View>
            ) : null}

            <View style={styles.rulesBox}>
              <ThemedText style={styles.logLine}>
                Links (▲▶▼◀) reach neighbouring cards. Attack = Signal, +2 if your mode overpowers theirs (Logic › Language › Vision › Sound › Dream › Logic). Defence = their Signal, +1 if they link back. Higher attack captures. Echo Wells ◈ add +1. Most cards after ten placements wins.
              </ThemedText>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GameColors.backgroundDark },
  header: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: "#a78bfa", gap: Spacing.sm },
  backBtn: { padding: Spacing.xs },
  resetBtn: { padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: GameColors.accent },
  title: { fontSize: 16, fontWeight: "700", color: "#c4b5fd" },
  subtitle: { fontSize: 11, color: GameColors.parchment, opacity: 0.75 },
  content: { padding: Spacing.md, gap: Spacing.md },
  wagerRow: { flexDirection: "row", gap: Spacing.sm },
  wagerChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: GameColors.primary, backgroundColor: "rgba(44,36,22,0.8)" },
  wagerChipActive: { borderColor: GameColors.accent, backgroundColor: "rgba(212,175,55,0.22)" },
  wagerText: { fontSize: 12, color: GameColors.parchment },
  scoreBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: "rgba(0,0,0,0.4)" },
  blueText: { color: "#7dd3fc", fontWeight: "700" },
  redText: { color: "#fda4af", fontWeight: "700" },
  statusText: { color: GameColors.accent, fontWeight: "700", fontSize: 12 },
  board: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  cell: { width: "23%", aspectRatio: 0.82, borderRadius: 10, borderWidth: 1, borderColor: "rgba(167,139,250,0.35)", backgroundColor: "rgba(24,18,40,0.85)", justifyContent: "center", alignItems: "center", padding: 4 },
  cellWell: { borderColor: "#fbbf24", backgroundColor: "rgba(251,191,36,0.08)" },
  cellBlue: { backgroundColor: "rgba(14,116,144,0.4)", borderColor: "#7dd3fc" },
  cellRed: { backgroundColor: "rgba(159,18,57,0.4)", borderColor: "#fda4af" },
  cellPreview: { borderColor: "#67e8f9", borderWidth: 2 },
  cellHover: { borderColor: "#c4b5fd", borderWidth: 2 },
  wellMark: { color: "#fbbf24", fontSize: 20, opacity: 0.7 },
  boardCardInner: { alignItems: "center" },
  cardSignal: { fontSize: 20, color: "#f8fafc", fontWeight: "800" },
  cardMiniName: { fontSize: 9, color: GameColors.parchment, fontWeight: "700" },
  cardLinks: { fontSize: 9, color: "#c4b5fd" },
  sectionHeading: { color: "#c4b5fd", fontSize: 13, fontWeight: "700" },
  handScroll: { flexGrow: 0 },
  handCard: { width: 120, padding: Spacing.sm, marginRight: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: "rgba(125,211,252,0.5)", backgroundColor: "rgba(14,116,144,0.18)" },
  handCardActive: { borderColor: GameColors.accent, borderWidth: 2 },
  handCardUsed: { opacity: 0.3 },
  handSignal: { fontSize: 22, color: "#f8fafc", fontWeight: "800" },
  handName: { fontSize: 12, color: GameColors.parchment, fontWeight: "700" },
  handMeta: { fontSize: 9, color: "#cbd5e1", opacity: 0.8 },
  handLinks: { fontSize: 11, color: "#c4b5fd", marginTop: 2 },
  handEcho: { fontSize: 9, color: "#fde68a", marginTop: 2 },
  resultBox: { gap: Spacing.sm, padding: Spacing.md, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: BorderRadius.md },
  resultTitle: { color: GameColors.accent, fontWeight: "700", fontSize: 13 },
  spoilCard: { padding: Spacing.sm, marginRight: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: GameColors.accent, backgroundColor: "rgba(212,175,55,0.15)" },
  logBox: { padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: "rgba(0,0,0,0.35)" },
  rulesBox: { padding: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: "rgba(124,58,237,0.12)" },
  logLine: { fontSize: 11, color: GameColors.parchment, opacity: 0.85 },
});
