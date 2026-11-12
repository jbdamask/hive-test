# Bee colony: game design

This is the design the prototype follows. It expands the "Design" section of the spec for issue #1 (hive/specs/1-bee-colony-game.md). Where building the game shows the design is wrong, this document changes in the same commit as the code.

In one paragraph: the player is the queen. She lays eggs, and a colony mix the player sets decides what each egg becomes; the player can also pick the caste of the next egg by hand. The bees then work on their own. Builders make comb, nurses raise larvae and clean cells, foragers bring in nectar and pollen from flower patches that scouts find, honeymakers make honey, and defenders guard the entrance. Murder hornets attack in waves, each larger than the last. The game runs for one season and scores how big the colony, the honey store, the comb and the hive have grown. It ends early if the hornets kill the queen.

## The player: the queen and her five kinds of choice

The player is the queen, acting as the colony's mind. She stays inside the hive. The bees do their jobs without being told; the player decides what kind of bees the colony has. The player has five kinds of choice, and every choice goes into the game record.

**Set the colony mix.** The mix gives each of the six castes a share, as a whole number. A caste's part of the eggs is its share divided by the sum of all six shares. Four ready-made mixes, Grow, Gather, Defend and Balanced, set all six shares in one click. A plus and a minus button next to each caste change that caste's share by one. The queen lays toward the mix: each egg becomes the caste that is furthest below its share of the eggs laid since the mix was last set. Choosing a ready-made mix, pressing plus or minus, and a notice's fix button all set the mix, so the count starts again from there. Hand-picked eggs are not counted, so the mix carries on where it was after one. If every share is zero, the queen lays no eggs.

**Pick the next egg's caste by hand.** At any time the player can choose the caste of the next egg. That one egg becomes the chosen caste, and the queen then goes back to laying by the mix.

**Match the mix now.** Changing the mix only changes what new eggs become. Match the mix now also moves adult bees between castes so the adults fit the current mix. The game shows one line naming the moves, for example "Move 4 foragers and 2 builders to defence. [Move] [Cancel]". It never asks the player which bee to move or how many.

**Answer a hornet warning.** When a scout sees a wave coming, the player answers with Defend or Keep my mix. The section on murder hornets below explains both.

**Keep Defend.** After a wave the player answered with Defend, the mix goes back to what it was before the warning. The player can click Keep Defend to stay on the Defend mix instead.

A new game starts on the Grow mix. Grow builds the colony quickly but lays few defenders, so a player who changes nothing grows a large colony and then loses the queen to a later wave.

## The six castes and their jobs

There are six castes, and between them they cover every job in John's description of the game.

| Caste | Job | John's words it covers |
|---|---|---|
| Builder | Turns honey into wax, builds comb cells and adds new chambers to the hive | "make a hive", "build it", "hive builders" |
| Nurse | Feeds larvae with pollen and honey, and cleans dirty cells | "tend to the hive", "clean it" |
| Forager | Flies to known flower patches and brings back nectar and pollen | "get pollen" |
| Honeymaker | Turns stored nectar into honey in comb cells | "make honey", "honeymakers" |
| Scout | Finds new flower patches, and spots hornet waves before they arrive | "scouts" |
| Defender | Guards the entrance and fights hornets | "defend themselves", "defenders" |

## The resources and the comb cells

The colony has five resources: nectar, pollen, honey, wax and comb cells.

- **Nectar** comes in with foragers. Honeymakers turn it into honey.
- **Pollen** comes in with foragers. Nurses feed it to larvae, and the queen needs it to lay.
- **Honey** is made by honeymakers. Builders turn it into wax, nurses feed it to larvae, and the queen needs it to lay.
- **Wax** is made by builders from honey and used to build comb cells and new chambers.
- **Comb cells** hold honey, nectar, pollen or brood (eggs and larvae). Every store and every young bee needs a cell, so the amount of comb limits both how much the colony can store and how large it can grow. Nectar, pollen or honey that finds no empty cell is lost.

**Dirty cells.** A cell that has been used, because a bee has hatched out of it or its store has been used up, becomes dirty. A dirty cell cannot be used again until a nurse cleans it. A colony with too few nurses runs out of clean cells even when it has plenty of comb.

**What an egg costs.** Each egg costs some honey and some pollen, and needs one clean, empty cell. The amounts are in the table of starting numbers below.

## When laying stops, and the one-line fix notice

The queen stops laying when she cannot pay for an egg: there is no clean empty cell, or not enough honey, or not enough pollen. Running out of cells has two causes: the cells are dirty, or every cell is full. When that happens, a one-line notice names the cause and offers a fix, for example:

> The queen has stopped laying: no clean cells. More nurses would clean them. [Add nurses]

The fix button adds one share to the caste it names; in this example, one share to Nurse. The player can undo it with that caste's minus button. The notice for too little honey names honeymakers, and the notice for too little pollen names foragers. When every cell is full and none is dirty, the notice says "no empty cells. More builders would build comb." and names builders.

## The life cycle

Every bee goes through three stages: egg, larva and adult. A larva has to be fed by nurses before it can become an adult. Adults live for a set time and then die, so the queen has to keep laying to keep the colony alive. A colony that stops laying shrinks.

## The meadow

The hive sits in a meadow of flower patches, laid out from the game's seed, so each seed gives a different meadow. Patches give nectar and pollen, run dry when foragers have used them, and grow back over time. Foragers only go to patches a scout has found, so a colony with no scouts cannot reach new patches when the known ones run dry.

## Murder hornets, the warning and its two answers

Murder hornets attack in waves. Waves come at set times in the season, and each wave is larger than the one before.

**The warning.** When a scout sees a wave coming, the game pauses and shows the size of the wave, when it will arrive and how many defenders the colony has:

> Hornets in 2 days: about 10. You have 4 defenders.
> [Defend] lays defenders first and moves 6 bees to defence now.
> [Keep my mix]

The game stays paused until the player clicks one of the two answers.

- **Defend** switches the colony mix to the Defend mix and does Match the mix now at once, so adult bees move to defence straight away and new eggs become mostly defenders.
- **Keep my mix** changes nothing.

The warning comes from a scout, so a colony with no scouts can be attacked with no warning.

**The fight.** Hornets fight the defenders at the hive entrance. Hornets that get past the defenders kill bees, eat brood and take honey. If hornets reach the queen, she dies and the game ends.

The fight goes in rounds a few ticks apart. In each round every defender takes on one hornet, at the entrance first and then inside; either the hornet dies or the defender does. A hornet no defender takes on gets in. Each hornet inside kills one bee, eats one egg or larva and takes some honey each round, and has a small chance each round of reaching the queen. A hornet that has taken all the honey it can carry flies off. A wave is over when every hornet in it is dead or gone.

## After a wave

If the player answered the warning with Defend, the mix goes back to the one set before the warning at the moment the last hornet of that wave is dead or gone. It does not go back after a set time, because a long wave would otherwise leave the hive short of defenders while hornets are still inside.

When the mix goes back, a notice says so and gives the defenders lost, for example:

> Wave beaten. 3 defenders lost. Your mix is back to Gather. [Keep Defend]

Keep Defend puts the Defend mix back. The game does not move adult bees back by itself; a player who wants the adults to fit the old mix again clicks Match the mix now.

If the player answered Keep my mix, nothing changes after the wave.

## Time

The game advances in fixed steps called ticks. A day is a fixed number of ticks, and a season is a fixed number of days. The game runs in real time, and the player can:

- pause and resume it with the Space key;
- play at normal speed with the 1 key;
- play at fast speed with the 2 key.

Speed changes only how many ticks run each second. It never changes what happens in a tick, so a game plays out the same at either speed. A season is sized so that a game takes 15 to 25 minutes at normal speed, not counting time paused.

## How a game ends

A game ends in one of two ways:

- **The season ends** with the queen alive.
- **The hornets kill the queen.**

The end screen says which of the two happened and shows the four score parts, the total, the seed, Copy game record, Play again and Replay this seed. Play again starts a new game on a new seed; Replay this seed starts a new game on the same seed.

## The points

The score has four parts, John's four measures:

- **Colony size:** the number of living adult bees, not counting the queen, eggs or larvae.
- **Honey made:** all the honey made over the game, including honey later eaten or taken by hornets.
- **Honeycomb:** the number of comb cells in the hive, the starting comb included.
- **Hive size:** the number of chambers in the hive.

Each part is shown on screen during play. The total is the four parts added up. The parts are counted at the moment the game ends, whichever way it ends. Hornets killed are not scored.

## The seed and ?seed=

Every game has a seed, a number shown on screen. The seed lays out the meadow and decides every other chance event in the game. The same seed with the same choices made at the same ticks gives the same game.

A new game picks a new seed unless the player types one on the title screen. Opening the page as `game/index.html?seed=<n>` starts a game on seed n, so a player, or an assistant helping a player, can hand someone a particular game to try.

## The game record

The game record is the seed plus every choice the player made, each with the tick at which it took effect. The record uses ticks, not days, because several choices can fall on the same day and the replay has to put each one at its exact moment. The player gets it from Copy game record on the end screen, as plain text.

- Pauses and speed changes are not in the record, because they do not change the game.
- A warning answer carries the tick of its warning, because the game is paused while the player answers.

The command-line runner reads the record (`node game/sim/run.js --record <file>`) and replays the game, and must print the same ending and the same score as the browser's end screen. This is how an assistant can look at a game the player lost and say what went wrong.

## Starting balance numbers

These are the values after tuning on seeds 1 to 20 (bead hive-test-hi1). The live values are in `game/data/balance.js`; when this table and that file differ, the file is right. Tuning made the first wave small, 3 hornets, and halved a hornet's chance of reaching the queen, so a player who keeps Grow usually lives through the first wave and loses the queen to a later one, as the design intends. A retune (bead hive-test-qlq) made the queen's fastest laying rate about 66 eggs a day instead of 8, because at 8 a day the colony settled at 160 bees whatever the player chose; now cells, honey and pollen limit her, as "When laying stops" says. Her eggs and the builders' wax both take honey, so a mix with few honeymakers, such as Grow, grows the comb and the hive more slowly.

**The four mixes.** Each number is a caste's share. A caste's part of the eggs is its share divided by 20, the sum of the shares in each mix.

| Caste | Grow | Gather | Defend | Balanced |
|---|---|---|---|---|
| Builder | 6 | 2 | 1 | 3 |
| Nurse | 6 | 3 | 3 | 4 |
| Forager | 4 | 7 | 2 | 4 |
| Honeymaker | 2 | 5 | 1 | 3 |
| Scout | 1 | 2 | 1 | 2 |
| Defender | 1 | 1 | 12 | 4 |

Grow lays few defenders: 1 egg in 20.

**Other numbers.**

| Number | Starting value |
|---|---|
| What an egg costs | 2 honey and 1 pollen, and one clean empty cell |
| How fast the queen can lay | At most one egg every 3 ticks, about 66 a day. Clean empty cells, honey or pollen usually stop her before this does, so how big the colony grows depends on the player's mix |
| How long an adult lives | 20 days |
| Ticks in a day | 200 |
| Days in a season | 60 |
| Ticks each second at normal speed | 10, so a day takes 20 seconds and a season 20 minutes |
| Ticks each second at fast speed | 30, so a season takes about 7 minutes |
| When the waves arrive | Days 16, 31 and 46, as the screen counts them (day 1 is the first day) |
| How many hornets in each wave | 3, then 10, then 20 |
| How far ahead a scout can see a wave | 2 days |
| A hornet inside the hive: its chance each fight round of reaching the queen | 1 in 20 |

The other numbers the rules need, such as the starting colony, the length of a fight round, a defender's chance against one hornet, a hornet's chance of reaching the queen, the cost of wax and comb, how long an egg and a larva take, and the size of the flower patches, are set in `game/data/balance.js` when the simulation is built.

## Why a player might stop

The product test asks whether a person who plays for a week on their own would keep playing, and what made them want to stop. These are the three things most likely to make a player stop, and what the design does about each.

**Clicking once per egg.** A game where the player must choose every egg turns into a chore. The colony mix lays eggs with no clicks at all; the player changes the mix only when they want the colony to change. A hand-picked egg is there for the moment the player needs one particular bee, such as a scout, and the queen goes back to the mix after it. Moving adult bees is one click, Match the mix now, and never a choice of which bee or how many.

**Losing to hornets with no warning.** Losing the queen to an attack the player never saw coming feels unfair. Every warning a scout gives pauses the game, even at fast speed, and shows the numbers needed to judge it: the wave's size, when it arrives and how many defenders the colony has. The player answers in one click, and after a Defend answer the mix goes back by itself when the wave is over. A colony with no scouts gets no warning, which is a risk the player can see and fix by keeping scouts in the mix.

**Too little to do between waves.** If the game plays itself between waves, there is nothing to decide. Between waves the player can change the mix, fine-tune it, pick an egg by hand and Match the mix now, and the notice when laying stops points to a choice worth making. A player who changes nothing loses the queen to a later wave, so the choices matter. The design cannot show that these choices are interesting to make; only the product test can show that, and the product reviewer's report on one full game records whether there was anything to decide between waves.
